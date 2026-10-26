import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type {
  Template,
  TemplateCategory,
  TemplateKind,
} from "../../types/planning";
import { createTemplate } from "../../types/planning";
import {
  BUILTIN_TEMPLATES,
  TEMPLATE_CATEGORY_LABELS,
  TEMPLATE_KIND_LABELS,
  type BuiltinTemplateSeed,
} from "./catalog";

export type TemplateSort = "popular" | "name" | "newest" | "used";

export interface TemplateLibraryOptions {
  category?: TemplateCategory | "all";
  templateKind?: TemplateKind | "all";
  query?: string;
  sort?: TemplateSort;
  source?: "all" | "builtin" | "mine";
  limit?: number;
}

export interface TemplateLibraryEntry {
  template: Template;
  categoryLabel: string;
  kindLabel: string;
  itemsCount: number;
}

function isPlanTemplate(template: Template): boolean {
  const payload = template.payload as { kind?: unknown } | null;
  return payload?.kind === "plan_template";
}

export function templateCategoryLabel(category: TemplateCategory): string {
  return TEMPLATE_CATEGORY_LABELS[category] ?? category;
}

export function templateKindLabel(kind: TemplateKind): string {
  return TEMPLATE_KIND_LABELS[kind] ?? kind;
}

export function templateLibrary(
  state: AppState,
  options: TemplateLibraryOptions = {},
): TemplateLibraryEntry[] {
  const category = options.category ?? "all";
  const templateKind = options.templateKind ?? "all";
  const query = (options.query ?? "").trim().toLowerCase();
  const sort = options.sort ?? "popular";
  const source = options.source ?? "all";

  const entries = Object.values(state.templates)
    .filter((template) => template.status === "active" && !isPlanTemplate(template))
    .filter((template) => (category === "all" ? true : template.category === category))
    .filter((template) => (templateKind === "all" ? true : template.templateKind === templateKind))
    .filter((template) => {
      if (source === "builtin") return template.builtin;
      if (source === "mine") return !template.builtin;
      return true;
    })
    .filter((template) => {
      if (!query) return true;
      return (
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.category.toLowerCase().includes(query) ||
        template.templateKind.toLowerCase().includes(query) ||
        template.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    })
    .map((template) => ({
      template,
      categoryLabel: templateCategoryLabel(template.category),
      kindLabel: templateKindLabel(template.templateKind),
      itemsCount: template.items.length,
    }));

  entries.sort((a, b) => {
    if (sort === "name") return a.template.name.localeCompare(b.template.name);
    if (sort === "newest") return b.template.createdAt - a.template.createdAt;
    if (sort === "used") return b.template.useCount - a.template.useCount;
    return b.template.popularity - a.template.popularity;
  });

  return options.limit != null ? entries.slice(0, options.limit) : entries;
}

export function templateCountsByCategory(state: AppState): Record<TemplateCategory, number> {
  const counts = {} as Record<TemplateCategory, number>;
  for (const key of Object.keys(TEMPLATE_CATEGORY_LABELS) as TemplateCategory[]) {
    counts[key] = 0;
  }
  for (const template of Object.values(state.templates)) {
    if (template.status !== "active") continue;
    if (template.builtin) continue;
    if (isPlanTemplate(template)) continue;
    counts[template.category] = (counts[template.category] ?? 0) + 1;
  }
  return counts;
}

export function recentlyUsedTemplates(
  state: AppState,
  now: Timestamp = Date.now(),
  limit = 4,
): Template[] {
  return Object.values(state.templates)
    .filter((template) => template.status === "active" && template.lastUsedAt != null && !isPlanTemplate(template))
    .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
    .slice(0, limit);
}

export function featuredTemplates(state: AppState): Template[] {
  const featured = BUILTIN_TEMPLATES.filter((seed) => seed.featured)
    .map((seed) => Object.values(state.templates).find((template) => template.name === seed.name))
    .filter((template): template is Template => template != null);
  if (featured.length > 0) return featured;
  return Object.values(state.templates)
    .filter((template) => template.builtin && template.status === "active")
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 2);
}

export function popularTemplates(state: AppState, limit = 6): Template[] {
  const popular = BUILTIN_TEMPLATES.filter((seed) => seed.popular)
    .map((seed) => Object.values(state.templates).find((template) => template.name === seed.name))
    .filter((template): template is Template => template != null);
  if (popular.length > 0) return popular.slice(0, limit);
  return Object.values(state.templates)
    .filter((template) => template.builtin && template.status === "active")
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, limit);
}

export function createBuiltinTemplate(seed: BuiltinTemplateSeed, now: Timestamp, id: ID): Template {
  const template = createTemplate(
    {
      name: seed.name,
      target: "task",
      title: seed.name,
      body: seed.description,
      description: seed.description,
      category: seed.category,
      templateKind: seed.templateKind,
      icon: seed.icon,
      builtin: true,
      popularity: seed.popularity,
      items: seed.items,
      tags: [seed.category, seed.templateKind],
    },
    now,
  );
  return { ...template, id };
}
