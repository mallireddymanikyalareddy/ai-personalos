"use client";

import type { LucideIcon } from "lucide-react";

import {
  Archive,
  BookOpen,
  FileText,
  Folder,
  GraduationCap,
  Heart,
  Lightbulb,
  Notebook,
  NotebookPen,
  Palette,
  PenLine,
  Plane,
  Sparkles,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";

export const NOTEBOOK_COLLECTION_ICONS: Record<string, LucideIcon> = {
  notebook: Notebook,
  personal: Heart,
  work: Users,
  projects: Folder,
  "meeting notes": Users,
  ideas: Lightbulb,
  learning: GraduationCap,
  finance: Wallet,
  health: Heart,
  travel: Plane,
  reading: BookOpen,
  journal: NotebookPen,
  templates: Palette,
  archive: Archive,
  trash: Trash2,
};

export function notebookCollectionIcon(name: string): LucideIcon {
  return NOTEBOOK_COLLECTION_ICONS[name.toLowerCase()] ?? Notebook;
}

export const NOTEBOOK_TAG_COLORS = [
  "var(--chart-5)",
  "var(--chart-4)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-3)",
  "var(--chart-2)",
  "var(--chart-1)",
  "var(--chart-8)",
];

export function notebookTagColor(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 997;
  }
  return NOTEBOOK_TAG_COLORS[hash % NOTEBOOK_TAG_COLORS.length]!;
}

export const NOTEBOOK_NOTE_ICONS = [
  "📄",
  "📘",
  "📊",
  "💡",
  "🧭",
  "🎯",
  "🗺️",
  "📝",
  "🧪",
  "🏗️",
  "📋",
  "🔭",
];

export function notebookNoteIcon(value: string | null | undefined): string {
  return value && value.length > 0 ? value : "📄";
}

export const NOTEBOOK_QUICK_CAPTURE_KINDS = [
  { id: "note", label: "Note", icon: FileText },
  { id: "handwriting", label: "Handwriting", icon: PenLine },
  { id: "upload", label: "Upload", icon: FileText },
  { id: "audio", label: "Audio", icon: Sparkles },
] as const;

export function relativeTime(at: number, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - at) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(at),
  );
}

export function notebookDateLabel(at: number, now: number = Date.now()): string {
  const today = new Date(now);
  const target = new Date(at);
  if (today.toDateString() === target.toDateString()) {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(target);
  }
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(target);
}
