export type PaperSort = "updated" | "created" | "title" | "words";

export type PaperView = "all" | "recent" | "favorites" | "shared";

export const PAPER_SORTS: { value: PaperSort; label: string }[] = [
  { value: "updated", label: "Last updated" },
  { value: "created", label: "Date created" },
  { value: "title", label: "Title" },
  { value: "words", label: "Word count" },
];
