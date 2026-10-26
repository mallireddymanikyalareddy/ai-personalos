import type { AppState } from "../../store/state";
import type { ID } from "../../types/common";
import type { NoteBlock } from "../../types/note";
import type { Page, PageRef } from "../../types/knowledge";
import type { AIProposal } from "./types";
import { flattenBlocks, headingLevel } from "../notebook";
import { pagesLinkingTo } from "../notebook/links";
import { suggestedRelatedPages } from "../notebook/promote";

export type NotebookAiAction =
  | "outline"
  | "continue"
  | "summarize"
  | "backlinks"
  | "extract_notes";

export interface NotebookAiInput {
  page: Page;
  action: NotebookAiAction;
  prompt?: string;
}

export interface NotebookAiResult {
  action: NotebookAiAction;
  message: string;
  proposals: AIProposal[];
  suggestions: Array<{ label: string; detail: string }>;
  blocks?: NoteBlock[];
  summary?: string;
  keyPoints?: string[];
}

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "about", "have", "has",
  "was", "were", "will", "would", "could", "should", "there", "their", "which", "while",
  "when", "what", "your", "they", "them", "then", "than", "these", "those", "been", "being",
]);

const OUTLINE_SHAPES = [
  "Context",
  "Problem",
  "Approach",
  "Evidence",
  "Tradeoffs",
  "Next steps",
];

function words(text: string): string[] {
  return text
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}-]/gu, ""))
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word.toLowerCase()));
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function keyPhrases(text: string, limit = 5): string[] {
  const counts = new Map<string, number>();
  for (const word of words(text)) {
    const key = word.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

function blocksToText(blocks: NoteBlock[]): string {
  return flattenBlocks(blocks)
    .map((entry) => entry.block.content.trim())
    .filter(Boolean)
    .join("\n");
}

function makeBlock(type: NoteBlock["type"], content: string): NoteBlock {
  return { id: `ai-${type}-${Math.random().toString(36).slice(2, 10)}`, type, content };
}

function proposal(
  capability: AIProposal["capability"],
  title: string,
  summary: string,
  payload: Record<string, unknown>,
  refs: AIProposal["refs"] = [],
): AIProposal {
  return {
    capability,
    title,
    summary,
    risk: "low",
    requiresConfirmation: true,
    preview: [{ label: title, detail: summary }],
    refs,
    payload,
    reasoning: summary,
  };
}

function pageRefs(pageId: ID): AIProposal["refs"] {
  return [{ entityType: "page", entityId: pageId }];
}

function outlineBlocks(page: Page, prompt: string): NoteBlock[] {
  const focus = prompt.trim().length > 0 ? prompt.trim() : page.title.trim();
  const headings = OUTLINE_SHAPES.slice(0, 5).map((shape, index) => ({
    ...makeBlock("heading", shape),
    attrs: { level: index === 0 ? 1 : 2 },
  }));
  const lead = makeBlock(
    "paragraph",
    `Why you are writing about ${focus || "this"}: the question this page answers.`,
  );
  return [headings[0], lead, ...headings.slice(1), makeBlock("paragraph", "")];
}

function continuationBlocks(page: Page, prompt: string): NoteBlock[] {
  const lastHeading = [...page.blocks].reverse().find((block) => block.type === "heading");
  const section = lastHeading ? lastHeading.content.trim() : "the current section";
  const seed = prompt.trim().length > 0 ? prompt.trim() : section;
  return [
    makeBlock("paragraph", `Building on ${seed || "the previous point"}:`),
    makeBlock(
      "bulletList",
      `What the evidence in this page already supports, stated plainly.`,
    ),
    makeBlock("bulletList", `The strongest objection a reader would raise next.`),
    makeBlock("bulletList", `The one concrete next step that would settle it.`),
  ];
}

export function runNotebookAssistant(
  input: NotebookAiInput,
  state: AppState,
): NotebookAiResult {
  const { page, action } = input;
  const text = blocksToText(page.blocks);

  switch (action) {
    case "outline": {
      const blocks = outlineBlocks(page, input.prompt ?? "");
      return {
        action,
        message: `Drafted a ${OUTLINE_SHAPES.length} part outline you can edit.`,
        blocks,
        proposals: [],
        suggestions: [
          { label: "Heading", detail: "Turn any line into a heading and build a table of contents." },
          { label: "Insert", detail: "Outline lands below the title, ready to edit." },
        ],
      };
    }
    case "continue": {
      const blocks = continuationBlocks(page, input.prompt ?? "");
      return {
        action,
        message: "Continued the page with three prompts to push the argument forward.",
        blocks,
        proposals: [],
        suggestions: [
          { label: "Evidence", detail: "Ask for the data that would settle the question." },
          { label: "Objection", detail: "Steelman the strongest counter-argument." },
        ],
      };
    }
    case "summarize": {
      const summarySentences = sentences(text).slice(0, 2).join(" ");
      const summary =
        summarySentences.length > 0
          ? summarySentences
          : `${page.title} is still a sketch — add some writing and the summary fills in.`;
      const keyPoints = keyPhrases(text, 6).map(
        (phrase) => `Recurring theme: ${phrase}`,
      );
      return {
        action,
        message: "Summarised the page and pulled out its recurring themes.",
        summary,
        keyPoints,
        proposals: [
          proposal(
            "notebook_summarize",
            "Save summary to page",
            summary,
            { summary, keyPoints },
            pageRefs(page.id),
          ),
        ],
        suggestions: keyPoints.slice(0, 3).map((point) => ({ label: "Theme", detail: point })),
      };
    }
    case "backlinks": {
      const linked = suggestedRelatedPages(state, page, 5);
      const inbound = pagesLinkingTo(state, { type: "page", id: page.id });
      const refs: Array<PageRef & { title: string }> = [
        ...page.refs.map((ref) => ({ ...ref, title: ref.label })),
        ...linked.map((candidate) => ({ type: "page" as const, id: candidate.id, label: "", title: candidate.title })),
      ];
      return {
        action,
        message:
          linked.length > 0 || inbound.length > 0
            ? `Found ${linked.length} related and ${inbound.length} inbound page${inbound.length === 1 ? "" : "s"}.`
            : "No related pages yet — link a note or another page to build the graph.",
        proposals: linked.map((candidate) =>
          proposal(
            "notebook_backlinks",
            `Link ${candidate.title}`,
            `Connect this page to "${candidate.title}" in the same notebook.`,
            { type: "page", id: candidate.id },
            pageRefs(page.id),
          ),
        ),
        suggestions: [
          ...refs.slice(0, 4).map((ref) => ({ label: "Linked", detail: ref.title || ref.id })),
          ...inbound.slice(0, 3).map((candidate) => ({ label: "Backlink", detail: candidate.title })),
        ],
      };
    }
    case "extract_notes": {
      const candidateSentences = sentences(text).filter(
        (sentence) => words(sentence).length >= 4,
      );
      if (candidateSentences.length === 0) {
        return {
          action,
          message: "Nothing long enough to pull out yet.",
          proposals: [],
          suggestions: [{ label: "Write more", detail: "Sentences of a few words become notes." }],
        };
      }
      return {
        action,
        message: `Found ${candidateSentences.length} sentence${candidateSentences.length === 1 ? "" : "s"} worth their own note.`,
        proposals: candidateSentences.slice(0, 4).map((sentence) =>
          proposal(
            "create_note",
            sentence.length > 60 ? `${sentence.slice(0, 57)}...` : sentence,
            "Save this sentence as a note so it can be worked on separately.",
            { title: sentence.slice(0, 60), body: sentence },
            pageRefs(page.id),
          ),
        ),
        suggestions: [{ label: "Notes", detail: "Each becomes an atomic note linked back to this page." }],
      };
    }
    default:
      return { action, message: "Nothing to do.", proposals: [], suggestions: [] };
  }
}

export function pageHeadingSummary(page: Page): Array<{ blockId: string; title: string; level: number }> {
  return flattenBlocks(page.blocks)
    .filter((entry) => entry.block.type === "heading")
    .map((entry) => ({
      blockId: entry.block.id,
      title: entry.block.content.trim(),
      level: headingLevel(entry.block) ?? 1,
    }))
    .filter((entry) => entry.title.length > 0);
}