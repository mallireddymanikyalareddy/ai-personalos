"use client";

import * as React from "react";

import { Sparkles } from "lucide-react";

import { AIAnswer } from "@/components/ai/ai-answer";
import { CreditConfirmDialog } from "@/components/ai/credit-confirm";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAIGateway } from "@/lib/use-ai-gateway";

import { adminSend, LoadState, useAdminData } from "./live";
import { PageHeader, Panel } from "./ui";

type Seo = {
  title: string;
  description: string;
  keywords: string;
  indexable: boolean;
  ogImage: string;
  siteUrl: string;
};

const field =
  "h-9 w-full rounded-lg border border-line bg-bg px-3 text-sm text-ink focus:border-accent focus:outline-none";

export function AdminSeo() {
  const { data, error, reload } = useAdminData<Seo>("seo");
  const { toast } = useToast();
  const ai = useAIGateway();
  const [form, setForm] = React.useState<Seo | null>(null);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (data) {
      setForm({ ...data, keywords: data.keywords ?? "" });
    }
  }, [data]);

  React.useEffect(() => {
    if (!ai.answer) return;
    const plain = ai.answer
      .replace(/\*\*/g, "")
      .replace(/^#{1,6}\s*/gm, "")
      .replace(/^\s*[-*]\s+/gm, "");
    const title = plain.match(/^\s*Title\s*:\s*(.+)$/im)?.[1]?.trim();
    const description = plain.match(/^\s*Description\s*:\s*(.+)$/im)?.[1]?.trim();
    if (!title && !description) return;
    setForm((current) =>
      current
        ? {
            ...current,
            title: (title ?? current.title).slice(0, 70),
            description: (description ?? current.description).slice(0, 160),
          }
        : current,
    );
    toast("Title and description filled from the AI draft. Review before saving.", { tone: "success" });
  }, [ai.answer, toast]);

  if (!data || !form) return <LoadState error={error} testId="admin-seo-state" />;

  const set = <K extends keyof Seo>(key: K, value: Seo[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const generate = () => {
    const context = [
      "Product: PersonalOS, an AI-powered personal operating system.",
      "Modules: Today, Tasks, Calendar, Planner, Goals, Habits, Notes, Journal, Projects, Meetings, Digital Paper, Digital Notebook, AI Assistant, Insights, Rewards, Templates, Life Memory, Work Mode.",
      `Current title: ${form.title}`,
      `Current description: ${form.description}`,
      "Audience: busy professionals, founders, students and creators who want one place to plan and organize life.",
    ].join("\n");
    void ai.request({
      action: "seo_metadata",
      prompt:
        "Generate an SEO title of at most 60 characters and a meta description of 140–155 characters. " +
        "Return exactly two lines: 'Title: ...' and 'Description: ...'. No marketing fluff, no emojis.",
      context,
      label: "Generate SEO metadata",
    });
  };

  const save = async () => {
    if (form.title.trim().length < 10) {
      toast("The page title must be at least 10 characters.", { tone: "danger" });
      return;
    }
    if (form.description.trim().length < 50) {
      toast("The meta description must be at least 50 characters.", { tone: "danger" });
      return;
    }
    if (reason.trim().length < 5) {
      toast("Add a reason (at least 5 characters).", { tone: "danger" });
      return;
    }
    setBusy(true);
    try {
      await adminSend("seo", "PUT", {
        title: form.title.trim(),
        description: form.description.trim(),
        keywords: form.keywords.trim(),
        indexable: form.indexable,
        og_image: form.ogImage.trim(),
        site_url: form.siteUrl.trim(),
        reason: reason.trim(),
      });
      toast("SEO settings saved.", { tone: "success" });
      setReason("");
      reload();
    } catch (err) {
      toast((err as Error).message, { tone: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const titleLength = form.title.length;
  const descriptionLength = form.description.length;

  return (
    <div className="space-y-4" data-testid="admin-seo">
      <PageHeader
        title="SEO"
        description="Control the public title, meta description, indexing and social preview. AI drafts use the seo_metadata gateway action."
      />
      <Panel title="Search appearance" testId="admin-seo-appearance">
        <div className="space-y-3">
          <label className="block text-xs font-medium text-ink-2">
            Page title
            <input
              className={`${field} mt-1`}
              value={form.title}
              maxLength={70}
              onChange={(event) => set("title", event.target.value)}
              data-testid="admin-seo-title"
            />
            <span className={titleLength > 60 ? "text-amber-600" : "text-ink-3"}>
              {titleLength}/70 characters{titleLength > 60 ? " · aim for 60 or fewer" : ""}
            </span>
          </label>

          <label className="block text-xs font-medium text-ink-2">
            Meta description
            <textarea
              className="mt-1 min-h-20 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              value={form.description}
              maxLength={160}
              onChange={(event) => set("description", event.target.value)}
              data-testid="admin-seo-description"
            />
            <span className={descriptionLength < 120 || descriptionLength > 160 ? "text-amber-600" : "text-ink-3"}>
              {descriptionLength}/160 characters · aim for 140–155
            </span>
          </label>

          <label className="block text-xs font-medium text-ink-2">
            Keywords
            <input
              className={`${field} mt-1`}
              value={form.keywords}
              maxLength={300}
              onChange={(event) => set("keywords", event.target.value)}
              data-testid="admin-seo-keywords"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-ink-2">
              Open Graph image
              <input
                className={`${field} mt-1`}
                value={form.ogImage}
                maxLength={200}
                onChange={(event) => set("ogImage", event.target.value)}
                placeholder="/landing/hero-devices.png"
              />
            </label>
            <label className="block text-xs font-medium text-ink-2">
              Canonical site URL
              <input
                className={`${field} mt-1`}
                value={form.siteUrl}
                maxLength={200}
                onChange={(event) => set("siteUrl", event.target.value)}
                placeholder="https://your-domain.com"
              />
            </label>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface-2 p-3">
            <div>
              <p className="text-sm font-medium text-ink">Allow search indexing</p>
              <p className="text-xs text-ink-3">
                When off, public pages get <code>noindex, nofollow</code>. Private app pages are always noindex.
              </p>
            </div>
            <input
              type="checkbox"
              checked={form.indexable}
              onChange={(event) => set("indexable", event.target.checked)}
              aria-label="Allow search indexing"
              data-testid="admin-seo-indexable"
            />
          </div>
        </div>
      </Panel>

      <Panel title="AI SEO draft" testId="admin-seo-ai">
        <p className="mb-3 text-xs text-ink-3">
          Uses the gateway action <code>seo_metadata</code> (1 credit). The answer is parsed into the title and description above; review before saving.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="primary" onClick={generate} disabled={!ai.gatewayEnabled}>
            <Sparkles className="size-3.5" aria-hidden="true" />
            Generate title & description
          </Button>
          <span className="text-[10px] text-ink-3">{ai.creditsNote}</span>
        </div>
        {!ai.gatewayEnabled && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
            Switch the AI provider to GPT 6 Luna to use AI generation. Manual editing and saving still work.
          </p>
        )}
        {ai.answer ? <AIAnswer text={ai.answer} className="mt-3 rounded-lg bg-surface-2 p-3" /> : null}
        <CreditConfirmDialog
          open={ai.pending != null}
          label={ai.pending?.label ?? "AI action"}
          estimate={ai.pending?.estimate ?? null}
          busy={ai.busy}
          onClose={ai.dismiss}
          onConfirm={() => void ai.confirm()}
        />
      </Panel>

      <Panel title="SEO checklist" testId="admin-seo-checklist">
        <ul className="space-y-1.5 text-xs text-ink-2">
          <li>• Keep the title at 60 characters or fewer and the description at 140–155.</li>
          <li>• Private routes (`/admin`, `/settings`, `/journal`, `/tasks`, etc.) stay noindex regardless of this toggle.</li>
          <li>• Set a canonical site URL so Open Graph and canonical links use absolute URLs.</li>
          <li>• Use a 1200×630 Open Graph image; the current asset is a marketing image.</li>
          <li>• `SoftwareApplication` and `Organization` structured data is included on the landing page.</li>
          <li>• Keep `robots.txt` and `sitemap.xml` pointing only at public pages.</li>
        </ul>
      </Panel>

      <div className="flex flex-wrap items-end gap-2">
        <input
          className={`${field} max-w-md`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={300}
          placeholder="Reason for the SEO change (required)"
          data-testid="admin-seo-reason"
        />
        <Button variant="primary" size="sm" loading={busy} disabled={busy} onClick={() => void save()} data-testid="admin-seo-save">
          Save SEO settings
        </Button>
      </div>
    </div>
  );
}
