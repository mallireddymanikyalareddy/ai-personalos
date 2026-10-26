"use client";

import type { LucideIcon } from "lucide-react";

import {
  Archive,
  BookOpen,
  Briefcase,
  FileText,
  Folder,
  Heart,
  Home,
  Lightbulb,
  Plane,
  PiggyBank,
} from "lucide-react";

import type { NoteSort } from "@personalos/core";

export const NOTE_TAG_COLORS = [
  "var(--chart-5)",
  "var(--chart-3)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-4)",
  "var(--chart-2)",
  "var(--chart-8)",
  "var(--chart-1)",
];

export function noteTagColor(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 997;
  }
  return NOTE_TAG_COLORS[hash % NOTE_TAG_COLORS.length]!;
}

const FOLDER_ICON: Record<string, LucideIcon> = {
  "all notes": FileText,
  archive: Archive,
  personal: Home,
  work: Briefcase,
  projects: Folder,
  ideas: Lightbulb,
  learning: BookOpen,
  health: Heart,
  finance: PiggyBank,
  travel: Plane,
  family: Home,
};

export function noteFolderIcon(name: string): LucideIcon {
  return FOLDER_ICON[name.toLowerCase()] ?? Folder;
}

export const NOTE_ICON_OPTIONS = [
  "🚀",
  "📄",
  "💡",
  "🧠",
  "📚",
  "🥗",
  "🏏",
  "🏠",
  "💰",
  "✈️",
  "🌱",
  "🎯",
  "🗓️",
  "🛠️",
];

export const NOTE_SORT_OPTIONS: { value: NoteSort; label: string }[] = [
  { value: "updated", label: "Last updated" },
  { value: "created", label: "Date created" },
  { value: "title", label: "Title" },
  { value: "words", label: "Word count" },
];

export function formatNoteTimestamp(at: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(at));
}

export function formatNoteDate(at: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(at),
  );
}

export const NOTE_BLOCK_TYPES: { value: string; label: string }[] = [
  { value: "paragraph", label: "Paragraph" },
  { value: "heading", label: "Heading" },
  { value: "bulletList", label: "Bulleted list" },
  { value: "orderedList", label: "Numbered list" },
  { value: "checkList", label: "Checklist" },
  { value: "blockquote", label: "Quote" },
  { value: "codeBlock", label: "Code" },
  { value: "table", label: "Table" },
  { value: "divider", label: "Divider" },
];

export const NOTE_FOLDER_PRESETS: { name: string; color: string }[] = [
  { name: "Personal", color: "var(--chart-3)" },
  { name: "Work", color: "var(--chart-5)" },
  { name: "Projects", color: "var(--chart-6)" },
  { name: "Ideas", color: "var(--chart-7)" },
  { name: "Learning", color: "var(--chart-4)" },
  { name: "Health", color: "var(--chart-2)" },
  { name: "Finance", color: "var(--chart-8)" },
  { name: "Travel", color: "var(--chart-1)" },
];