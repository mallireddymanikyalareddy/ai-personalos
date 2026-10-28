import ipaddress
import logging
import os
import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import httpx
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger("digest")

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
DONE = {"done", "cancelled", "archived"}

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _check_no_forms(scan: "_EmailScan") -> None:
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")


def _check_no_credential_asks(subject: str, html: str) -> None:
    body = f"{subject}\n{html}".lower()
    hit = next((p for p in _CRED_ASK if p in body), None)
    if hit:
        raise ValueError(f"Email asks the recipient for credentials: {hit!r} (G2)")


def _check_url(url: str) -> None:
    low = url.strip().lower()
    if low.startswith(("mailto:", "tel:", "cid:", "#")):
        return
    if not low.startswith("https://"):
        raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
    parsed = urlparse(low)
    if not _host_ok(parsed.hostname or "") or parsed.username is not None:
        raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")


def _check_anchor(href: str, text: str) -> None:
    real = urlparse(href.strip().lower()).hostname or ""
    if not real:
        return
    for m in _HOSTISH.finditer(text):
        if not _same_site(m.group(1).lower(), real):
            raise ValueError(f"Anchor text {m.group(1)!r} ≠ real link host {real!r} (G3)")


def _assert_safe_email(subject: str, html: str) -> None:
    """Outgoing-content safety guard (not recipient address validation)."""
    scan = _EmailScan()
    scan.feed(html)
    _check_no_forms(scan)
    _check_no_credential_asks(subject, html)
    for url in scan.urls:
        _check_url(url)
    for href, text in scan.anchors:
        _check_anchor(href, text)


class EmailUnavailable(Exception):
    pass


def email_configured() -> bool:
    return bool(os.environ.get("EMERGENT_EMAIL_KEY"))


async def send_email(*, to: str, subject: str, html: str) -> str | None:
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": os.environ.get("EMAIL_FROM_NAME") or "PersonalOS"}
    if os.environ.get("EMAIL_REPLY_TO"):
        payload["contact_email"] = os.environ["EMAIL_REPLY_TO"]
    async with httpx.AsyncClient(timeout=30) as http:
        resp = await http.post(f"{EMAIL_BASE_URL}/api/v1/email/send", headers={"X-Email-Key": os.environ["EMERGENT_EMAIL_KEY"]}, json=payload)
    if resp.status_code >= 400:
        try:
            data = resp.json()
        except ValueError:
            data = {}
        logger.warning("Email send refused: %s %s %s", resp.status_code, data.get("code", ""), data.get("message", ""))
        raise EmailUnavailable(data.get("code") or f"status {resp.status_code}")
    return resp.json().get("id")


def iso_week(now: datetime) -> str:
    year, week, _ = now.isocalendar()
    return f"{year}-W{week:02d}"


def local_now(tz: str) -> datetime:
    try:
        return datetime.now(ZoneInfo(tz))
    except Exception:
        return datetime.now(timezone.utc)


def _rows(state: dict, key: str) -> list[dict]:
    return [r for r in (state.get(key) or {}).values() if isinstance(r, dict)]


def _due_key(task: dict) -> float:
    return task.get("dueAt") or 0


def _open_tasks(state: dict) -> list[dict]:
    return [t for t in _rows(state, "tasks") if t.get("status") not in DONE]


def _split_by_due(tasks: list[dict], now_ms: float, week_end_ms: float) -> tuple[list[dict], list[dict]]:
    dated = sorted((t for t in tasks if t.get("dueAt")), key=_due_key)
    overdue = [t for t in dated if t["dueAt"] < now_ms]
    due_week = [t for t in dated if now_ms <= t["dueAt"] <= week_end_ms]
    return overdue, due_week


def _collect(envelope: dict | None, now: datetime) -> dict:
    state = (envelope or {}).get("state") or {}
    now_ms = now.timestamp() * 1000
    tasks = _open_tasks(state)
    overdue, due_week = _split_by_due(tasks, now_ms, now_ms + 7 * 86_400_000)
    return {
        "overdue": overdue[:8],
        "due_week": due_week[:12],
        "open_count": len(tasks),
        "goals": [g for g in _rows(state, "goals") if g.get("status") == "active"][:8],
        "habits": [h for h in _rows(state, "habits") if not h.get("archivedAt")][:8],
    }


def _prompt_context(data: dict) -> str:
    def lines(rows, fmt):
        return "\n".join(fmt(r) for r in rows) or "none"
    due = lambda t: datetime.fromtimestamp(t["dueAt"] / 1000, timezone.utc).strftime("%a %b %d")  # noqa: E731
    return (
        f"Overdue tasks:\n{lines(data['overdue'], lambda t: '- ' + str(t.get('title')) + ' (was due ' + due(t) + ')')}\n\n"
        f"Due this week:\n{lines(data['due_week'], lambda t: '- ' + str(t.get('title')) + ' (due ' + due(t) + ', ' + str(t.get('priority')) + ')')}\n\n"
        f"Active goals:\n{lines(data['goals'], lambda g: '- ' + str(g.get('title')) + ' (' + str(round(g.get('progress') or 0)) + '% done)')}\n\n"
        f"Habits:\n{lines(data['habits'], lambda h: '- ' + str(h.get('title')))}"
    )


async def ai_weekly_plan(name: str, data: dict) -> str | None:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return None
    chat = LlmChat(
        api_key=key,
        session_id=str(uuid.uuid4()),
        system_message="You write short, warm, practical weekly plans for users of PersonalOS. Plain text only, no links, no markdown headings.",
    ).with_model("openai", "gpt-6-luna")
    prompt = (
        f"Write {name}'s plan for this week in 4-6 short bullet lines starting with '- ': what to tackle first (overdue items), "
        f"how to spread this week's tasks across days, which goal to push forward, and which habit to protect. "
        f"Finish with one encouraging sentence.\n\n{_prompt_context(data)}"
    )
    try:
        return (await chat.send_message(UserMessage(text=prompt))).strip()
    except Exception as exc:
        logger.warning("Weekly plan AI failed: %s", str(exc)[:200])
        return None


def _ai_html(text: str) -> str:
    items, paras = [], []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith(("- ", "* ", "• ")):
            items.append(f"<li style=\"margin:0 0 6px\">{escape(line[2:].strip())}</li>")
        else:
            paras.append(f"<p style=\"margin:8px 0\">{escape(line)}</p>")
    lst = f"<ul style=\"padding-left:18px;margin:8px 0\">{''.join(items)}</ul>" if items else ""
    return lst + "".join(paras)


def _section(title: str, rows: list[str]) -> str:
    if not rows:
        return ""
    body = "".join(f"<tr><td style=\"padding:6px 0;border-bottom:1px solid #eee;font-size:14px;color:#333\">{r}</td></tr>" for r in rows)
    return (f"<h3 style=\"margin:24px 0 8px;font-size:15px;color:#111\">{escape(title)}</h3>"
            f"<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\">{body}</table>")


def _goal_row(g: dict) -> str:
    pct = max(0, min(100, round(g.get("progress") or 0)))
    return (f"{escape(str(g.get('title', 'Goal')))} <span style=\"color:#666\">— {pct}%</span>"
            f"<div style=\"margin-top:4px;height:6px;background:#eee;border-radius:3px\">"
            f"<div style=\"width:{pct}%;height:6px;background:#4f46e5;border-radius:3px\"></div></div>")


def _due(t: dict) -> str:
    return datetime.fromtimestamp(t["dueAt"] / 1000, timezone.utc).strftime("%a %b %d")


def build_email(name: str, data: dict, plan: str | None, week_label: str) -> tuple[str, str]:
    brand = os.environ.get("EMAIL_FROM_NAME") or "PersonalOS"
    app_url = os.environ.get("APP_URL", "").rstrip("/")
    subject = f"Your {brand} plan for the week of {week_label}"
    plan_html = _ai_html(plan) if plan else "<p style=\"margin:8px 0;color:#666\">Your AI weekly plan wasn't available this time, but here's where things stand.</p>"
    link = (f"<p style=\"margin:28px 0 0\"><a href=\"{escape(app_url)}/today\" style=\"background:#4f46e5;color:#fff;"
            f"padding:10px 18px;border-radius:8px;text-decoration:none;font-size:14px\">Open {escape(brand)}</a></p>"
            if app_url.startswith("https://") else "")
    html = (
        "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"background:#f6f6f8\"><tr><td align=\"center\" style=\"padding:24px\">"
        "<table role=\"presentation\" width=\"600\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width:600px;background:#fff;border-radius:12px\">"
        "<tr><td style=\"padding:28px;font-family:Arial,Helvetica,sans-serif;color:#111\">"
        f"<p style=\"margin:0;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#4f46e5\">{escape(brand)} · Week of {escape(week_label)}</p>"
        f"<h2 style=\"margin:8px 0 16px;font-size:22px\">Good morning, {escape(name)}</h2>"
        f"<h3 style=\"margin:16px 0 4px;font-size:15px\">Your plan for the week (GPT 6 Luna)</h3>{plan_html}"
        + _section(f"Overdue ({len(data['overdue'])})", [f"{escape(str(t.get('title')))} <span style=\"color:#b91c1c\">— was due {_due(t)}</span>" for t in data["overdue"]])
        + _section(f"Due this week ({len(data['due_week'])})", [f"{escape(str(t.get('title')))} <span style=\"color:#666\">— {_due(t)}</span>" for t in data["due_week"]])
        + _section("Goal progress", [_goal_row(g) for g in data["goals"]])
        + _section("Habits to keep up", [escape(str(h.get("title"))) for h in data["habits"]])
        + link
        + f"<p style=\"margin:28px 0 0;font-size:12px;color:#888\">You're receiving this because you turned on the Monday briefing email in {escape(brand)} settings. "
        f"Turn it off anytime in Settings → Notifications. We never ask for your password by email.</p>"
        "</td></tr></table></td></tr></table>"
    )
    return subject, html


async def send_account_link(user: dict, kind: str, url: str) -> None:
    brand = os.environ.get("EMAIL_FROM_NAME") or "PersonalOS"
    if kind == "reset":
        subject, intro, cta = f"Reset your {brand} password", "We got a request to reset your password. This link works for 1 hour.", "Choose a new password"
    else:
        subject, intro, cta = f"Confirm your email for {brand}", "Confirm this email address for your account. This link works for 24 hours.", "Confirm email"
    html = (
        "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\"><tr><td style=\"padding:24px;font-family:Arial,sans-serif;color:#111\">"
        f"<p>Hi {escape(user.get('display_name') or 'there')},</p><p>{escape(intro)}</p>"
        f"<p style=\"margin:24px 0\"><a href=\"{escape(url)}\" style=\"background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none\">{escape(cta)}</a></p>"
        f"<p style=\"font-size:12px;color:#888\">If you didn't ask for this, you can ignore this email. Sent by {escape(brand)}. We never ask for your password by email.</p>"
        "</td></tr></table>"
    )
    try:
        await send_email(to=user["email"], subject=subject, html=html)
    except EmailUnavailable:
        logger.warning("Account email (%s) not sent for %s", kind, user["id"])


def public_app_url() -> str | None:
    value = os.environ.get("APP_URL", "").strip().rstrip("/")
    return value if value.startswith("https://") else None


def _account_email(brand: str, title: str, intro: str, url: str, cta: str,
                   footer: str = "You can change credit alerts in Settings.") -> str:
    return (
        "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\"><tr>"
        "<td style=\"padding:24px;font-family:Arial,sans-serif;color:#111\">"
        f"<h2 style=\"margin:0 0 12px;font-size:20px\">{escape(title)}</h2>"
        f"<p style=\"margin:0 0 16px;line-height:1.5\">{intro}</p>"
        f"<p style=\"margin:24px 0\"><a href=\"{escape(url)}\" style=\"background:#4f46e5;color:#fff;"
        f"padding:10px 18px;border-radius:8px;text-decoration:none\">{escape(cta)}</a></p>"
        f"<p style=\"font-size:12px;color:#888\">Sent by {escape(brand)}. {escape(footer)}</p>"
        "</td></tr></table>"
    )


async def send_low_credits(user: dict, available: int, threshold: int, days_left: int | None) -> None:
    base = public_app_url()
    if not base:
        logger.warning("APP_URL is not set; low-credit email skipped")
        return
    brand = os.environ.get("EMAIL_FROM_NAME") or "PersonalOS"
    when = f" At your current pace, that is about {days_left} day{'s' if days_left != 1 else ''} left." if days_left is not None else ""
    subject = f"Your {brand} AI credits are low"
    html = _account_email(
        brand, f"You have {available} AI credit{'s' if available != 1 else ''} left",
        f"Your balance is at or below the {threshold}-credit alert threshold.{escape(when)} "
        "Top up or move to a plan with monthly credits to keep AI replies, briefings and reflections running.",
        f"{base}/settings?tab=ai", "View your credits")
    await send_email(to=user["email"], subject=subject, html=html)


async def send_weekly_credits(user: dict, available: int, reserved: int, used: int, days_left: int | None) -> None:
    base = public_app_url()
    if not base:
        logger.warning("APP_URL is not set; weekly credit summary skipped")
        return
    brand = os.environ.get("EMAIL_FROM_NAME") or "PersonalOS"
    pace = f" At the last two weeks' pace, your balance lasts about {days_left} day{'s' if days_left != 1 else ''}." if days_left is not None else ""
    held = f" and {reserved} on hold" if reserved else ""
    subject = f"Your {brand} weekly credit summary"
    html = _account_email(
        brand, "Your weekly AI credit summary",
        f"You have <strong>{available}</strong> credit{'s' if available != 1 else ''} available{escape(held)}. "
        f"You used <strong>{used}</strong> in the last 7 days.{escape(pace)}",
        f"{base}/settings?tab=ai", "See credit history")
    await send_email(to=user["email"], subject=subject, html=html)


async def send_admin_spend(admin: dict, estimated_paise: int, charged: int, threshold_paise: int,
                           month_label: str) -> None:
    base = public_app_url()
    if not base:
        logger.warning("APP_URL is not set; admin spend email skipped")
        return
    brand = os.environ.get("EMAIL_FROM_NAME") or "PersonalOS"
    subject = f"{brand} monthly AI spend alert"
    html = _account_email(
        brand, f"AI spend alert for {month_label}",
        f"Estimated AI usage value has reached <strong>₹{estimated_paise / 100:,.2f}</strong> "
        f"({charged} credits) against your ₹{threshold_paise / 100:,.2f} alert threshold.",
        f"{base}/admin/usage", "Review AI usage", "Manage this threshold in Admin → Platform Settings.")
    await send_email(to=admin["email"], subject=subject, html=html)


async def send_digest(item: dict) -> None:
    now = local_now(item.get("timezone") or "UTC")
    name = (item.get("displayName") or "there").split(" ")[0]
    data = _collect(item.get("envelope"), now)
    plan = await ai_weekly_plan(name, data)
    monday = (now - timedelta(days=now.weekday())).strftime("%b %d")
    subject, html = build_email(name, data, plan, monday)
    await send_email(to=item["email"], subject=subject, html=html)


_recent: dict[str, list[float]] = {}


def allow_send_now(user_id: str, limit: int = 3, window: float = 3600) -> bool:
    now = time.time()
    hits = [t for t in _recent.get(user_id, []) if now - t < window]
    if len(hits) >= limit:
        _recent[user_id] = hits
        return False
    _recent[user_id] = hits + [now]
    return True
