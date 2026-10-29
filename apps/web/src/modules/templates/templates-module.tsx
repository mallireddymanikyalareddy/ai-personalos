"use client";

import * as React from "react";

import type { LucideIcon } from "lucide-react";

import {
  ArrowRight,
  Book,
  BookOpen,
  Briefcase,
  CalendarDays,
  Coins,
  Copy,
  Crosshair,
  Download,
  Dumbbell,
  Feather,
  FilePlus2,
  Flame,
  FolderOpen,
  GraduationCap,
  Heart,
  Layers,
  LayoutTemplate,
  Loader2,
  MoreHorizontal,
  Plane,
  Plus,
  Receipt,
  Rocket,
  Search,
  Sparkles,
  Star,
  Target,
  Upload,
  Users,
  Utensils,
  Wallet,
  Zap,
} from "lucide-react";

import {
  TEMPLATE_CATEGORY_LABELS,
  TEMPLATE_KIND_LABELS,
  planTemplatePayload,
  type Template,
  type TemplateCategory,
  type TemplateKind,
} from "@personalos/core";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditConfirmDialog } from "@/components/ai/credit-confirm";
import { DropdownMenu } from "@/components/ui/dropdown";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { useAIGateway } from "@/lib/use-ai-gateway";
import { downloadText } from "@/modules/notebook/notebook-export";
import { findJsonEntry, readZip, zipEntryText } from "@/lib/zip";
import { useAppState, useOS } from "@/store/use-os";
import { useFocusNow } from "@/modules/focus/use-focus-now";

import { TemplateEditorDialog } from "./template-editor-dialog";
import { TemplatePreviewDialog } from "./template-preview-dialog";
import { seedTemplateDefaults } from "./sample-templates";

const CATEGORY_ICONS: Record<TemplateCategory, LucideIcon> = {
  work: Briefcase,
  personal: Heart,
  planning: CalendarDays,
  finance: Coins,
  health: Flame,
  learning: GraduationCap,
  productivity: Zap,
  projects: Layers,
};

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  calendar: CalendarDays,
  "calendar-days": CalendarDays,
  users: Users,
  layers: Layers,
  flame: Flame,
  target: Target,
  laptop: Briefcase,
  rocket: Rocket,
  crosshair: Crosshair,
  "book-open": BookOpen,
  receipt: Receipt,
  wallet: Wallet,
  utensils: Utensils,
  dumbbell: Dumbbell,
  book: Book,
  plane: Plane,
  "graduation-cap": GraduationCap,
  feather: Feather,
  download: Download,
};

const CATEGORY_ORDER: TemplateCategory[] = [
  "work",
  "personal",
  "planning",
  "finance",
  "health",
  "learning",
  "productivity",
  "projects",
];

const CATEGORY_TONES: Record<TemplateCategory, string> = {
  work: "bg-info-soft text-info",
  personal: "bg-danger-soft text-danger",
  planning: "bg-accent-soft text-accent-ink",
  finance: "bg-success-soft text-success",
  health: "bg-warning-soft text-warning",
  learning: "bg-accent-soft text-accent-ink",
  productivity: "bg-info-soft text-info",
  projects: "bg-danger-soft text-danger",
};

type SortMode = "popular" | "name" | "newest" | "used";
type DialogMode = "blank" | "existing" | "ai" | null;

function formatUsers(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
}

function relative(at: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - at) / 60_000));
  if (minutes < 60) return minutes <= 1 ? "just now" : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.round(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

export function TemplatesModule() {
  const os = useOS();
  useAppState();
  const { toast } = useToast();
  const ai = useAIGateway();

  const [category, setCategory] = React.useState<TemplateCategory | "all">("all");
  const [kind, setKind] = React.useState<TemplateKind | "all">("all");
  const [sort, setSort] = React.useState<SortMode>("popular");
  const [query, setQuery] = React.useState("");
  const [mineOnly, setMineOnly] = React.useState(false);
  const [favoritesOnly, setFavoritesOnly] = React.useState(false);
  const [dialog, setDialog] = React.useState<DialogMode>(null);
  const [editingTemplate, setEditingTemplate] = React.useState<Template | null>(null);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [previewTemplate, setPreviewTemplate] = React.useState<Template | null>(null);

  const now = useFocusNow(60_000);

  React.useEffect(() => {
    os.seedTemplateCatalog(Date.now());
  }, [os]);

  const templates = os.templates().filter((template) => planTemplatePayload(template) == null);
  const recent = os.recentlyUsedTemplates(now, 4);
  const counts = os.templateCounts();
  const mineTotal = Object.values(counts).reduce((sum, value) => sum + value, 0);

  const matches = (template: Template): boolean => {
    if (category !== "all" && template.category !== category) return false;
    if (kind !== "all" && template.templateKind !== kind) return false;
    if (mineOnly && template.builtin) return false;
    if (favoritesOnly && !template.favorite) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      template.name.toLowerCase().includes(q) ||
      template.description.toLowerCase().includes(q) ||
      template.category.toLowerCase().includes(q) ||
      template.templateKind.toLowerCase().includes(q) ||
      template.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  };

  const featured = os.featuredTemplates().filter(matches);
  const popular = os.popularTemplates(6).filter(matches);

  const library = os.templateLibrary({
    category,
    templateKind: kind,
    query,
    sort,
    source: mineOnly ? "mine" : "all",
  }).filter((entry) => !favoritesOnly || entry.template.favorite);

  const applyTemplate = (template: Template) => {
    const result = os.useTemplate(template.id, now);
    toast(result.message, { tone: result.ok ? "success" : "danger" });
  };

  const openEditor = (template: Template | null) => {
    setEditingTemplate(template);
    setEditorOpen(true);
  };
  const openPreview = (template: Template) => setPreviewTemplate(template);

  const duplicateTemplate = (template: Template) => {
    const copy = os.duplicateTemplate(template.id, now);
    if (copy) toast(`Duplicated "${template.name}"`, { tone: "success" });
  };

  const exportTemplate = (template: Template) => {
    const slug =
      template.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "template";
    downloadText(
      `${slug}.json`,
      JSON.stringify(
        {
          name: template.name,
          description: template.description,
          category: template.category,
          templateKind: template.templateKind,
          items: template.items,
        },
        null,
        2,
      ),
      "application/json",
    );
    toast("Template exported", { tone: "success" });
  };

  const deleteTemplate = (template: Template) => {
    if (!window.confirm(`Delete "${template.name}"?`)) return;
    os.deleteTemplate(template.id);
    toast("Template deleted", { tone: "success" });
  };

  const loadDefaults = () => {
    const created = seedTemplateDefaults(os, now);
    toast(
      created > 0
        ? `Sample template data loaded - ${created} item${created === 1 ? "" : "s"} added`
        : "Sample template data is already loaded",
    );
  };

  const runTemplateAI = (id: "generate" | "fill" | "improve") => {
    const template = previewTemplate ?? editingTemplate;
    const context = template
      ? `${template.name}\n${template.description ?? ""}\n${template.body ?? ""}`
      : `Template idea: ${query || "a reusable personal operating system template"}`;
    const meta =
      id === "generate"
        ? { action: "template_generate", prompt: "Generate a reusable template with clear sections and prompts.", label: "Generate template" }
        : id === "fill"
          ? { action: "template_fill", prompt: "Fill this template with realistic example content.", label: "Fill template" }
          : { action: "template_improve", prompt: "Improve this template's structure, clarity and usefulness.", label: "Improve template" };
    if (!ai.gatewayEnabled) {
      ai.setAnswer(`Local ${meta.label.toLowerCase()}: add clear headings, prompts and a short example for each section.`);
      return;
    }
    void ai.request({ ...meta, context });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        testId="templates-header"
        icon={LayoutTemplate}
        title="Templates"
        subtitle="Ready-to-use templates to plan, organize, track and get more done in your life and work."
        actions={
          <>
            <DropdownMenu
              align="end"
              sections={[
                {
                  label: "Create",
                  items: [
                    { label: "Blank template", onSelect: () => openEditor(null) },
                    { label: "From an existing template", onSelect: () => setDialog("existing") },
                    { label: "Generate with AI", onSelect: () => runTemplateAI("generate") },
                  ],
                },
              ]}
              trigger={
                <Button variant="primary" size="sm" data-testid="templates-create">
                  <Plus className="size-4" aria-hidden="true" />
                  Create Template
                </Button>
              }
            />
            <ImportButton onImported={(message, ok) => toast(message, { tone: ok ? "success" : "danger" })} />
            <DropdownMenu
              align="end"
              sections={[
                {
                  label: "Templates",
                  items: [
                    { label: "Load default data", onSelect: loadDefaults },
                    {
                      label: mineOnly ? "Show all templates" : "Show only my templates",
                      onSelect: () => setMineOnly((value) => !value),
                    },
                  ],
                },
              ]}
              trigger={
                <Button variant="secondary" size="icon" aria-label="Templates options">
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </Button>
              }
            />
          </>
        }
      />

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-card" aria-label="AI template assistant" data-testid="templates-ai-panel">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Sparkles className="size-4 text-accent-ink" aria-hidden="true" />
          AI template assistant
        </h2>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => runTemplateAI("generate")}>Generate template</Button>
          <Button size="sm" variant="ghost" onClick={() => runTemplateAI("fill")}>Fill template</Button>
          <Button size="sm" variant="ghost" onClick={() => runTemplateAI("improve")}>Improve template</Button>
        </div>
        {ai.answer ? (
          <p className="mt-2 whitespace-pre-line rounded-xl border border-line bg-surface-2 p-3 text-[12px] text-ink-2" data-testid="templates-ai-answer">
            {ai.answer}
          </p>
        ) : null}
        <p className="mt-1.5 text-[10px] text-ink-3" data-testid="templates-ai-credits">{ai.creditsNote}</p>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <nav aria-label="Template categories" className="flex flex-wrap gap-2" data-testid="templates-categories">
            <CategoryChip
              id="all"
              label="All Templates"
              active={category === "all" && !mineOnly}
              onSelect={() => {
                setCategory("all");
                setMineOnly(false);
                setFavoritesOnly(false);
              }}
              count={templates.length}
            />
            <CategoryChip
              id="favorites"
              label="Favourites"
              icon={Star}
              active={favoritesOnly}
              onSelect={() => {
                setFavoritesOnly((value) => !value);
                setCategory("all");
                setMineOnly(false);
              }}
              count={templates.filter((template) => template.favorite).length}
            />
            {CATEGORY_ORDER.map((key) => (
              <CategoryChip
                key={key}
                id={key}
                label={TEMPLATE_CATEGORY_LABELS[key]}
                icon={CATEGORY_ICONS[key]}
                active={category === key}
                onSelect={() => {
                  setCategory(key);
                  setMineOnly(false);
                  setFavoritesOnly(false);
                }}
                count={templates.filter((template) => template.category === key).length}
              />
            ))}
          </nav>

          {featured.length > 0 ? (
            <section aria-label="Featured templates" data-testid="templates-featured" className="grid gap-3 md:grid-cols-2">
              {featured.map((template, index) => (
                <article
                  key={template.id}
                  data-testid="templates-featured-card"
                  className={cn(
                    "relative overflow-hidden rounded-2xl border p-5 shadow-card",
                    index === 0
                      ? "border-transparent bg-gradient-to-br from-chart-1 to-chart-7 text-white"
                      : "border-line bg-gradient-to-br from-info-soft via-surface to-accent-soft",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      index === 0 ? "bg-white/20 text-white" : "bg-warning-soft text-warning",
                    )}
                  >
                    {index === 0 ? (
                      <Star className="size-3" aria-hidden="true" />
                    ) : (
                      <Sparkles className="size-3" aria-hidden="true" />
                    )}
                    {index === 0 ? "Featured Template" : "Featured"}
                  </span>
                  <h2 className={cn("mt-2 text-lg font-bold tracking-tight", index === 0 ? "text-white" : "text-ink")}>
                    {template.name}
                  </h2>
                  <p className={cn("mt-1 max-w-xs text-[12px]", index === 0 ? "text-white/85" : "text-ink-2")}>
                    {template.description}
                  </p>
                  <Button
                    variant={index === 0 ? "secondary" : "primary"}
                    size="sm"
                    className="mt-3"
                    data-testid="templates-use-featured"
                    onClick={() => applyTemplate(template)}
                  >
                    Use Template
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                </article>
              ))}
            </section>
          ) : null}

          {popular.length > 0 ? (
            <section aria-label="Popular templates" data-testid="templates-popular">
              <header className="mb-2 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Flame className="size-4 text-warning" aria-hidden="true" />
                  Popular Templates
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setCategory("all");
                    setQuery("");
                    setMineOnly(false);
                    setFavoritesOnly(false);
                  }}
                  className="text-[11px] font-medium text-accent-ink hover:underline"
                >
                  View All
                </button>
              </header>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {popular.map((template) => (
                  <li key={template.id} data-testid="templates-popular-card">
                    <TemplateCard
                      template={template}
                      onUse={() => applyTemplate(template)}
                      onFavorite={() => os.toggleTemplateFavorite(template.id, now)}
                      onPreview={() => openPreview(template)}
                      onEdit={() => openEditor(template)}
                      onDuplicate={() => duplicateTemplate(template)}
                      onExport={() => exportTemplate(template)}
                      onDelete={() => deleteTemplate(template)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-label="Template library" data-testid="templates-library">
            <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Layers className="size-4 text-accent-ink" aria-hidden="true" />
                Template Library
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3"
                    aria-hidden="true"
                  />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search templates"
                    aria-label="Search templates"
                    className="h-8 w-44 pl-8 text-[12px]"
                    data-testid="templates-search"
                  />
                </div>
                <Select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as TemplateCategory | "all")}
                  aria-label="Filter by category"
                  className="w-36"
                  data-testid="templates-category-filter"
                >
                  <option value="all">All Categories</option>
                  {CATEGORY_ORDER.map((key) => (
                    <option key={key} value={key}>
                      {TEMPLATE_CATEGORY_LABELS[key]}
                    </option>
                  ))}
                </Select>
                <Select
                  value={kind}
                  onChange={(event) => setKind(event.target.value as TemplateKind | "all")}
                  aria-label="Filter by type"
                  className="w-32"
                  data-testid="templates-kind-filter"
                >
                  <option value="all">All Types</option>
                  {Object.entries(TEMPLATE_KIND_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
                <Select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortMode)}
                  aria-label="Sort templates"
                  className="w-36"
                  data-testid="templates-sort"
                >
                  <option value="popular">Sort by: Popular</option>
                  <option value="name">Sort by: Name</option>
                  <option value="newest">Sort by: Newest</option>
                  <option value="used">Sort by: Most used</option>
                </Select>
              </div>
            </header>
            {library.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line p-8 text-center">
                <p className="text-sm font-medium text-ink">No templates match that filter</p>
                <p className="mt-1 text-[12px] text-ink-3">
                  Try a different category, or clear the search to see the whole catalog.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setCategory("all");
                    setKind("all");
                    setQuery("");
                    setMineOnly(false);
                    setFavoritesOnly(false);
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {library.map((entry) => (
                  <li key={entry.template.id} data-testid="templates-library-card">
                    <TemplateCard
                      template={entry.template}
                      onUse={() => applyTemplate(entry.template)}
                      onFavorite={() => os.toggleTemplateFavorite(entry.template.id, now)}
                      onPreview={() => openPreview(entry.template)}
                      onEdit={() => openEditor(entry.template)}
                      onDuplicate={() => duplicateTemplate(entry.template)}
                      onExport={() => exportTemplate(entry.template)}
                      onDelete={() => deleteTemplate(entry.template)}
                      showUsers
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-4" aria-label="Template tools">
          <section
            aria-label="Create from template"
            data-testid="templates-create-panel"
            className="rounded-2xl border border-line bg-surface p-4 shadow-card"
          >
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Sparkles className="size-4 text-accent-ink" aria-hidden="true" />
              Create from Template
            </h2>
            <ul className="space-y-1.5">
              <CreateRow
                id="blank"
                icon={FilePlus2}
                title="Blank Template"
                detail="Start with a clean template"
                onSelect={() => openEditor(null)}
              />
              <CreateRow
                id="existing"
                icon={Copy}
                title="From Existing"
                detail="Duplicate and customize"
                onSelect={() => setDialog("existing")}
              />
              <CreateRow
                id="ai"
                icon={Sparkles}
                title="AI Generate"
                detail="Create a template using AI"
                onSelect={() => setDialog("ai")}
              />
              <CreateRow
                id="import"
                icon={Upload}
                title="Import Template"
                detail="Upload a JSON or ZIP template file"
                onSelect={() => document.getElementById("templates-import-input")?.click()}
              />
            </ul>
          </section>

          <section
            aria-label="My templates"
            data-testid="templates-mine"
            className="rounded-2xl border border-line bg-surface p-4 shadow-card"
          >
            <header className="mb-2 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <FolderOpen className="size-4 text-accent-ink" aria-hidden="true" />
                My Templates ({mineTotal})
              </h2>
              <button
                type="button"
                onClick={() => {
                  setMineOnly(true);
                  setCategory("all");
                }}
                className="text-[11px] font-medium text-accent-ink hover:underline"
              >
                View All
              </button>
            </header>
            {mineTotal === 0 ? (
              <p className="text-[12px] text-ink-3">
                Nothing here yet. Duplicate a template or make your own to see it listed.
              </p>
            ) : (
              <ul className="space-y-1">
                {CATEGORY_ORDER.filter((key) => counts[key] > 0).map((key) => {
                  const Icon = CATEGORY_ICONS[key];
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => {
                          setMineOnly(true);
                          setCategory(key);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-surface-2"
                        data-testid="templates-mine-row"
                      >
                        <span className={cn("grid size-6 place-items-center rounded-md", CATEGORY_TONES[key])} aria-hidden="true">
                          <Icon className="size-3.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12px] text-ink-2">
                          {TEMPLATE_CATEGORY_LABELS[key]} Templates
                        </span>
                        <span className="text-[12px] font-semibold tabular-nums text-ink">{counts[key]}</span>
                        <ChevronRight className="size-3.5 text-ink-3" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section
            aria-label="Recently used"
            data-testid="templates-recent"
            className="rounded-2xl border border-line bg-surface p-4 shadow-card"
          >
            <header className="mb-2 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Loader2 className="size-4 text-accent-ink" aria-hidden="true" />
                Recently Used
              </h2>
              <button
                type="button"
                onClick={() => setCategory("all")}
                className="text-[11px] font-medium text-accent-ink hover:underline"
              >
                View All
              </button>
            </header>
            {recent.length === 0 ? (
              <p className="text-[12px] text-ink-3">Templates you use will show up here.</p>
            ) : (
              <ul className="space-y-1.5">
                {recent.map((template) => {
                  const Icon = TEMPLATE_ICONS[template.icon ?? ""] ?? LayoutTemplate;
                  return (
                    <li key={template.id}>
                      <button
                        type="button"
                        onClick={() => applyTemplate(template)}
                        className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-surface-2"
                        data-testid="templates-recent-row"
                      >
                        <span
                          className={cn("grid size-7 shrink-0 place-items-center rounded-lg", CATEGORY_TONES[template.category])}
                          aria-hidden="true"
                        >
                          <Icon className="size-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-medium text-ink">{template.name}</span>
                          <span className="block text-[10px] text-ink-3">
                            Used {relative(template.lastUsedAt ?? now, now)}
                          </span>
                        </span>
                        <ChevronRight className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <TemplateDialog
        mode={dialog}
        onClose={() => setDialog(null)}
        templates={templates}
        onCreated={(message) => toast(message, { tone: "success" })}
      />
      <TemplateEditorDialog
        open={editorOpen}
        template={editingTemplate}
        onClose={() => {
          setEditorOpen(false);
          setEditingTemplate(null);
        }}
      />
      <TemplatePreviewDialog
        template={previewTemplate}
        onClose={() => setPreviewTemplate(null)}
      />
      <CreditConfirmDialog
        open={ai.pending != null}
        label={ai.pending?.label ?? "AI action"}
        estimate={ai.pending?.estimate ?? null}
        busy={ai.busy}
        onClose={ai.dismiss}
        onConfirm={() => void ai.confirm()}
      />
    </div>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CategoryChip({
  id,
  label,
  icon: Icon,
  active,
  onSelect,
  count,
}: {
  id: string;
  label: string;
  icon?: LucideIcon;
  active: boolean;
  onSelect: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      data-testid={`templates-category-${id}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
        active
          ? "border-accent bg-accent text-white"
          : "border-line bg-surface text-ink-2 hover:border-line-strong hover:bg-surface-2",
      )}
    >
      {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : <Layers className="size-3.5" aria-hidden="true" />}
      {label}
      {count != null ? (
        <span className={cn("text-[10px] tabular-nums", active ? "text-white/80" : "text-ink-3")}>{count}</span>
      ) : null}
    </button>
  );
}

function CreateRow({
  id,
  icon: Icon,
  title,
  detail,
  onSelect,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  detail: string;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        data-testid={`templates-create-${id}`}
        className="flex w-full items-center gap-2.5 rounded-xl border border-line p-2 text-left transition-colors hover:bg-surface-2"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-ink" aria-hidden="true">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-medium text-ink">{title}</span>
          <span className="block truncate text-[11px] text-ink-3">{detail}</span>
        </span>
      </button>
    </li>
  );
}

function TemplateCard({
  template,
  onUse,
  onFavorite,
  onPreview,
  onEdit,
  onDuplicate,
  onExport,
  onDelete,
  showUsers = false,
}: {
  template: Template;
  onUse: () => void;
  onFavorite: () => void;
  onPreview?: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onExport?: () => void;
  onDelete?: () => void;
  showUsers?: boolean;
}) {
  const Icon = TEMPLATE_ICONS[template.icon ?? ""] ?? LayoutTemplate;
  return (
    <div className="flex h-full flex-col gap-1.5 rounded-2xl border border-line bg-surface p-3 shadow-card transition-colors hover:border-line-strong">
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn("grid size-9 place-items-center rounded-xl", CATEGORY_TONES[template.category])}
          aria-hidden="true"
        >
          <Icon className="size-4.5" />
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onFavorite}
            aria-label={template.favorite ? `Remove ${template.name} from favourites` : `Add ${template.name} to favourites`}
            aria-pressed={template.favorite}
            data-testid="templates-favorite"
            className="rounded-md p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-warning"
          >
            <Star
              className={cn("size-4", template.favorite && "fill-warning text-warning")}
              aria-hidden="true"
            />
          </button>
          <DropdownMenu
            align="end"
            sections={[
              {
                label: template.name,
                items: [
                  ...(onPreview ? [{ label: "Preview", onSelect: onPreview }] : []),
                  ...(onEdit && !template.builtin
                    ? [{ label: "Edit template", onSelect: onEdit }]
                    : []),
                  ...(onDuplicate ? [{ label: "Duplicate", onSelect: onDuplicate }] : []),
                  ...(onExport ? [{ label: "Export JSON", onSelect: onExport }] : []),
                  ...(onDelete && !template.builtin
                    ? [{ label: "Delete", danger: true, onSelect: onDelete }]
                    : []),
                ],
              },
            ]}
            trigger={
              <button
                type="button"
                aria-label={`${template.name} options`}
                className="rounded-md p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </button>
            }
          />
        </div>
      </div>
      <button type="button" onClick={onUse} className="text-left" data-testid="templates-use">
        <span className="block truncate text-[13px] font-semibold text-ink">{template.name}</span>
        <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-ink-3">
          {template.description}
        </span>
      </button>
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <Badge className={cn("capitalize", CATEGORY_TONES[template.category])}>
          {TEMPLATE_CATEGORY_LABELS[template.category]}
        </Badge>
        {showUsers ? (
          <span className="flex items-center gap-1 text-[10px] tabular-nums text-ink-3">
            <Users className="size-3" aria-hidden="true" />
            {formatUsers(template.popularity)}
          </span>
        ) : (
          <span className="text-[10px] tabular-nums text-ink-3">
            {template.items.length} item{template.items.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}

function ImportButton({ onImported }: { onImported: (message: string, ok: boolean) => void }) {
  const os = useOS();
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <>
      <input
        ref={inputRef}
        id="templates-import-input"
        type="file"
        accept="application/json,.json,application/zip,.zip"
        className="hidden"
        data-testid="templates-import-input"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          try {
            if (/\.zip$/i.test(file.name) || file.type.includes("zip")) {
              const entries = await readZip(file);
              const jsonEntry = findJsonEntry(entries);
              if (!jsonEntry) {
                onImported("That ZIP does not contain a JSON template.", false);
                return;
              }
              const result = os.importTemplate(zipEntryText(jsonEntry), Date.now());
              onImported(result.message, result.ok);
              return;
            }
            const raw = await file.text();
            const result = os.importTemplate(raw, Date.now());
            onImported(result.message, result.ok);
          } catch {
            onImported("That file could not be read.", false);
          }
        }}
      />
      <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} data-testid="templates-import">
        <Upload className="size-4" aria-hidden="true" />
        Import
      </Button>
    </>
  );
}

function TemplateDialog({
  mode,
  onClose,
  templates,
  onCreated,
}: {
  mode: DialogMode;
  onClose: () => void;
  templates: Template[];
  onCreated: (message: string) => void;
}) {
  const os = useOS();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState<TemplateCategory>("work");
  const [kind, setKind] = React.useState<TemplateKind>("planner");
  const [prompt, setPrompt] = React.useState("");
  const [sourceId, setSourceId] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (mode === null) return;
    setName("");
    setDescription("");
    setPrompt("");
    setError(null);
    setSourceId(templates[0]?.id ?? "");
  }, [mode, templates]);

  if (mode === null) return null;

  const createBlank = () => {
    if (!name.trim()) {
      setError("Give the template a name");
      return;
    }
    os.addTemplate(
      {
        name: name.trim(),
        target: "task",
        title: name.trim(),
        body: description.trim(),
        description: description.trim() || "A custom template you made.",
        category,
        templateKind: kind,
        icon: "sparkles",
        builtin: false,
        source: "custom",
        tags: [category, kind],
        items: [
          {
            kind: "task",
            title: `Start ${name.trim()}`,
            detail: description.trim(),
            cadence: null,
            tags: [category],
            priority: 3,
            sections: [],
            group: "",
          },
        ],
      },
      Date.now(),
    );
    onCreated(`Created "${name.trim()}"`);
    onClose();
  };

  const duplicateExisting = () => {
    const source = templates.find((template) => template.id === sourceId);
    if (!source) {
      setError("Pick a template to duplicate");
      return;
    }
    const copy = os.duplicateTemplate(source.id, Date.now());
    if (copy) onCreated(`Duplicated "${source.name}"`);
    onClose();
  };

  const generate = () => {
    if (!prompt.trim()) {
      setError("Describe the template you want");
      return;
    }
    const template = os.createTemplateFromPrompt(prompt, Date.now());
    if (!template) {
      setError("That prompt could not be turned into a template");
      return;
    }
    onCreated(`Generated "${template.name}"`);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={
        mode === "blank"
          ? "Blank template"
          : mode === "existing"
            ? "Duplicate an existing template"
            : "Generate a template with AI"
      }
      description={
        mode === "blank"
          ? "Start from nothing - you can edit the items later."
          : mode === "existing"
            ? "Your copy keeps the structure and lands in My Templates."
            : "Describe what you want to repeat and the template is built for you."
      }
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          {mode === "blank" ? (
            <Button variant="primary" size="sm" onClick={createBlank} data-testid="templates-dialog-create">
              Create template
            </Button>
          ) : mode === "existing" ? (
            <Button variant="primary" size="sm" onClick={duplicateExisting} data-testid="templates-dialog-duplicate">
              Duplicate
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={generate} data-testid="templates-dialog-generate">
              Generate
            </Button>
          )}
        </div>
      }
    >
      {error ? (
        <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-[12px] text-danger" data-testid="templates-dialog-error">
          {error}
        </p>
      ) : null}

      {mode === "blank" ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="templates-name" className="block text-xs font-medium text-ink-3">
              Template name
            </label>
            <Input
              id="templates-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Weekly client check-in"
              data-testid="templates-name-input"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="templates-description" className="block text-xs font-medium text-ink-3">
              What is it for?
            </label>
            <Textarea
              id="templates-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="A short description so you recognise it later."
              data-testid="templates-description-input"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="templates-category" className="block text-xs font-medium text-ink-3">
                Category
              </label>
              <Select
                id="templates-category"
                value={category}
                onChange={(event) => setCategory(event.target.value as TemplateCategory)}
              >
                {CATEGORY_ORDER.map((key) => (
                  <option key={key} value={key}>
                    {TEMPLATE_CATEGORY_LABELS[key]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="templates-kind" className="block text-xs font-medium text-ink-3">
                Type
              </label>
              <Select
                id="templates-kind"
                value={kind}
                onChange={(event) => setKind(event.target.value as TemplateKind)}
              >
                {Object.entries(TEMPLATE_KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      ) : null}

      {mode === "existing" ? (
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {templates.map((template) => (
            <li key={template.id}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line p-2 transition-colors hover:bg-surface-2">
                <input
                  type="radio"
                  name="templates-source"
                  value={template.id}
                  checked={sourceId === template.id}
                  onChange={() => setSourceId(template.id)}
                  className="accent-[var(--accent)]"
                />
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-medium text-ink">{template.name}</span>
                  <span className="block truncate text-[11px] text-ink-3">{template.description}</span>
                </span>
                <Badge className={cn("ml-auto capitalize", CATEGORY_TONES[template.category])}>
                  {TEMPLATE_CATEGORY_LABELS[template.category]}
                </Badge>
              </label>
            </li>
          ))}
        </ul>
      ) : null}

      {mode === "ai" ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="templates-prompt" className="block text-xs font-medium text-ink-3">
              Describe the template
            </label>
            <Textarea
              id="templates-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="A weekly budget planner for my household"
              data-testid="templates-prompt-input"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["weekly review checklist", "workout plan for beginners", "meeting notes template", "monthly budget tracker"].map(
              (suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setPrompt(suggestion)}
                  className="rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-2 transition-colors hover:bg-surface-2"
                >
                  {suggestion}
                </button>
              ),
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
