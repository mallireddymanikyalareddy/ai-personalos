"use client";

import type { LucideIcon } from "lucide-react";

import {
  BookOpen,
  Briefcase,
  FileImage,
  FileText,
  Folder,
  Heart,
  Layers,
  PenLine,
  ScanLine,
  Sparkles,
  Star,
  Trash2,
  Type,
  Users,
  Wallet,
} from "lucide-react";

import type { PaperPageKind } from "@personalos/core";

export const PAPER_KIND_META: Record<PaperPageKind, { label: string; icon: LucideIcon; tone: string }> = {
  handwritten: { label: "Handwritten", icon: PenLine, tone: "bg-accent-soft text-accent-ink" },
  typed: { label: "Typed document", icon: Type, tone: "bg-info-soft text-info" },
  template: { label: "Template", icon: Layers, tone: "bg-success-soft text-success" },
  scan: { label: "Scanned file", icon: ScanLine, tone: "bg-warning-soft text-warning" },
  pdf: { label: "PDF", icon: FileText, tone: "bg-danger-soft text-danger" },
  image: { label: "Image", icon: FileImage, tone: "bg-accent-soft text-accent-ink" },
};

export function paperKindMeta(kind: PaperPageKind) {
  return PAPER_KIND_META[kind] ?? PAPER_KIND_META.typed;
}

export const PAPER_FOLDER_ICONS: Record<string, LucideIcon> = {
  folder: Folder,
  personal: Heart,
  work: Briefcase,
  projects: Layers,
  "meeting notes": Users,
  ideas: Sparkles,
  learning: BookOpen,
  finance: Wallet,
  health: Heart,
  travel: Sparkles,
  trash: Trash2,
  layers: Layers,
  star: Star,
};

export const PAPER_TAG_COLORS = [
  "var(--chart-5)",
  "var(--chart-4)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-3)",
  "var(--chart-2)",
  "var(--chart-1)",
  "var(--chart-8)",
];

export function paperTagColor(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 997;
  }
  return PAPER_TAG_COLORS[hash % PAPER_TAG_COLORS.length]!;
}

export const PAPER_QUICK_CAPTURE_KINDS = [
  { id: "text", label: "Text", icon: Type },
  { id: "checklist", label: "Checklist", icon: Layers },
  { id: "image", label: "Image", icon: FileImage },
  { id: "file", label: "File", icon: FileText },
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
  if (days < 14) return "1 week ago";
  return `${Math.round(days / 7)} weeks ago`;
}
