# Verifying the admin console and credit engine

Two ways to verify: a one-command smoke check against a running server, and a manual UI walk-through.

## 1. Automated smoke check

The account must be an admin.

```powershell
python scripts/verify_admin_credit.py `
  --base-url http://localhost:8001 `
  --identifier YOUR_ADMIN_HANDLE `
  --password "YOUR_PASSWORD"
```

Environment fallbacks:

```powershell
$env:BASE_URL="http://localhost:8001"
$env:ADMIN_IDENTIFIER="owner"
$env:ADMIN_PASSWORD="..."
python scripts/verify_admin_credit.py
```

It prints PASS/FAIL for:

- admin login and role
- dashboard revenue, ARR/MRR relation, plan distribution, recent subscription events
- credit summary reset date, refunds, stuck holds, reconciliation count
- reconciliation queue
- plan features and pre-publish preview
- published pricing version
- support, security, MFA and past-due grace settings
- subscriber credit overview (`aiAllowed`, plan, reset, allowance)
- usage cost columns and actual-cost totals
- audit request IDs

If the account uses MFA, the script stops and tells you to complete `/api/v1/auth/mfa/verify` first.

## 2. Manual UI walk-through

### Admin routes

| Area | Route |
|---|---|
| Dashboard | `/admin` |
| Users | `/admin/users` |
| Approvals | `/admin/approvals` |
| Subscriptions | `/admin/subscriptions` |
| Plans & Pricing | `/admin/plans` |
| Credit Management | `/admin/credits` |
| AI Usage & Costs | `/admin/usage` |
| AI Action Pricing | `/admin/pricing` |
| Promotions & Grants | `/admin/promotions` |
| Audit Logs | `/admin/audit` |
| Platform Settings | `/admin/settings` |

### Dashboard
Check: MRR, ARR (`MRR × 12`), plan distribution, recent subscription events, estimated cost per successful request, and the alert center.

### Users
- Filter by status and plan.
- Open a user: subscription block, subscription events, credit buckets, ledger.
- **Suspend** with a reason → sign-in blocked for that user, sessions revoked.
- **Reinstate** → sign-in works again.

### Credit Management
- **Next credit reset**, **Refunded**, **Stuck / reconciliation** stats.
- **Stuck holds & reconciliation**: resolve as refund or confirmed charge.
- **Ledger reconciliation errors**: stored balance vs ledger deltas.

### AI Usage & Costs
- **Actual provider cost** stat and **Est. cost / Actual cost** columns.
- **Cost** on a succeeded request → record an invoice cost; reports prefer it over the estimate.
- **Refund** on a succeeded request → partial or full, idempotent.

### Plans & Pricing
- **Preview** shows a draft diff and affected subscriber count.
- **Feature entitlements** are editable, one per line.
- **Hide from new subscriptions** blocks new subscriptions server-side (`PLAN_UNAVAILABLE`); existing subscriptions continue.

### AI Action Pricing
- Per-action credits, max output, **input credits / 1k**, **max input tokens**, **daily limit**, **model route**.
- Draft → publish; historical usage keeps its pricing version.

### Platform Settings
- Support email/link/status page/hours.
- **Past-due grace (days)**: AI pauses after this many days past due; non-AI features and data remain available.
- Admin-wide MFA requirement, session policy, audit retention.
- Feature flags, including `ai_confirmation_modal`.

### Audit Logs
- Read-only, append-only.
- **Request** column shows the request ID; CSV exports include it.

### Subscriber views
- Header badge: plan + reset date in the tooltip.
- `/settings?tab=ai`: plan, next reset, allowance, annual bonus, buckets, refund history.
- `/ai`: confirmation modal with cost, balance, expected remaining, limits; past-due banner when AI is paused; post-answer credits used/remaining.
- `/plans`: upgrade options.

## 3. Expected automated results

```powershell
python -m pytest backend/tests/test_iter25_credit_buckets_unit.py `
  backend/tests/test_iter26_alerts_unit.py `
  backend/tests/test_iter25_email_links_unit.py `
  backend/tests/test_iter25_entitlements_unit.py -q
# 28 passed

npm run typecheck --workspace @personalos/web
npm run lint --workspace @personalos/web   # 0 errors
$env:STATIC_EXPORT='1'; npm run build --workspace @personalos/web
```

The full web suite has two remaining stale onboarding tests; all admin, credit, AI, settings and today tests pass.
