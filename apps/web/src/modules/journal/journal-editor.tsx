"use client";

import * as React from "react";

import {
  Bold,
  CheckSquare,
  Code,
  Heading1,
  Heading2,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  Quote,
  Underline,
} from "lucide-react";

import { newId } from "@personalos/core";
import type { JournalEntry } from "@personalos/core";
import type { NoteBlock } from "@personalos/core";

import { useToast } from "@/components/ui/toast";

export type SaveState = "saved" | "saving" | "error";

export interface JournalEditorHandle {
  focus(): void;
  insertBlock(block: NoteBlock): void;
}

interface JournalEditorProps {
  entry: JournalEntry;
  onChange: (patch: Partial<JournalEntry>) => void;
  onSaveStateChange: (state: SaveState) => void;
  onSelectMention?: (name: string) => void;
}

type ToolbarAction =
  | "bold"
  | "italic"
  | "underline"
  | "heading1"
  | "heading2"
  | "bullet"
  | "numbered"
  | "checklist"
  | "quote"
  | "link"
  | "image"
  | "code"
  | "divider"
  | "mention"
  | "tag";

const TOOLS: Array<{ id: ToolbarAction; label: string; icon: React.ComponentType<{ className?: string }>; shortcut?: string }> = [
  { id: "bold", label: "Bold", icon: Bold, shortcut: "Ctrl+B" },
  { id: "italic", label: "Italic", icon: Italic, shortcut: "Ctrl+I" },
  { id: "underline", label: "Underline", icon: Underline, shortcut: "Ctrl+U" },
  { id: "heading1", label: "Heading 1", icon: Heading1 },
  { id: "heading2", label: "Heading 2", icon: Heading2 },
  { id: "bullet", label: "Bullet list", icon: List },
  { id: "numbered", label: "Numbered list", icon: ListOrdered },
  { id: "checklist", label: "Checklist", icon: CheckSquare },
  { id: "quote", label: "Quote", icon: Quote },
  { id: "link", label: "Link", icon: Link, shortcut: "Ctrl+K" },
  { id: "image", label: "Image", icon: Image },
  { id: "code", label: "Code block", icon: Code },
  { id: "divider", label: "Divider", icon: Minus },
  { id: "mention", label: "Mention a person", icon: List },
  { id: "tag", label: "Add a tag", icon: List },
];

export const JournalEditor = React.forwardRef<JournalEditorHandle, JournalEditorProps>(
  function JournalEditor({ entry, onChange, onSaveStateChange }, ref) {
    const { toast } = useToast();
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const bodyRef = React.useRef<string>(entry.body);
    const [saveState, setSaveState] = React.useState<SaveState>("saved");
    const autosaveRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const [draft, setDraft] = React.useState(entry.body);
    const lastEntryId = React.useRef(entry.id);
    const lastSentBody = React.useRef(entry.body);

  React.useEffect(() => {
    const isNewEntry = entry.id !== lastEntryId.current;
    const externalChange = entry.body !== lastSentBody.current;
    if (!isNewEntry && !externalChange) return;
    lastEntryId.current = entry.id;
    lastSentBody.current = entry.body;
    setDraft(entry.body);
    bodyRef.current = entry.body;
  }, [entry.id, entry.body]);

  React.useImperativeHandle(ref, () => ({
    focus() {
      textareaRef.current?.focus();
    },
    insertBlock(block) {
      const next = `${bodyRef.current}${bodyRef.current.endsWith("\n") ? "" : "\n"}${block.content}\n`;
      bodyRef.current = next;
      setDraft(next);
      onChange({ body: next });
    },
  }));

  const applyFormat = (action: ToolbarAction) => {
    const area = textareaRef.current;
    const body = bodyRef.current;
    if (!area) return;

    const start = area.selectionStart;
    const end = area.selectionEnd;
    const selected = body.slice(start, end);
    const prefix = body.slice(0, start);
    const suffix = body.slice(end);

      let next = body;
      switch (action) {
        case "bold":
          next = `${prefix}**${selected || "bold text"}**${suffix}`;
          break;
        case "italic":
          next = `${prefix}_${selected || "italic text"}_${suffix}`;
          break;
        case "underline":
          next = `${prefix}<u>${selected || "underlined text"}</u>${suffix}`;
          break;
        case "heading1":
          next = `${prefix}\n# ${selected || "Heading"}${suffix}`;
          break;
        case "heading2":
          next = `${prefix}\n## ${selected || "Heading"}${suffix}`;
          break;
        case "bullet":
          next = `${prefix}\n- ${selected || "List item"}${suffix}`;
          break;
        case "numbered":
          next = `${prefix}\n1. ${selected || "List item"}${suffix}`;
          break;
        case "checklist":
          next = `${prefix}\n- [ ] ${selected || "Checklist item"}${suffix}`;
          break;
        case "quote":
          next = `${prefix}\n> ${selected || "Quote"}${suffix}`;
          break;
        case "link": {
          const url = window.prompt("Link URL");
          if (!url) return;
          next = `${prefix}[${selected || "link text"}](${url})${suffix}`;
          break;
        }
        case "image": {
          const url = window.prompt("Image URL");
          if (!url) return;
          next = `${prefix}\n![${selected || "image"}](${url})${suffix}`;
          break;
        }
        case "code":
          next = `${prefix}\n\`\`\`\n${selected || "code"}\n\`\`\`${suffix}`;
          break;
        case "divider":
          next = `${prefix}\n\n---\n\n${suffix}`;
          break;
        case "mention": {
          const name = window.prompt("Who do you want to mention?");
          if (!name) return;
          next = `${prefix}@${name.trim().replace(/\s+/g, "")}${suffix}`;
          break;
        }
        case "tag": {
          const tag = window.prompt("Tag to add");
          if (!tag) return;
          if (!entry.tags.includes(tag.trim().toLowerCase())) {
            onChange({ tags: [...entry.tags, tag.trim().toLowerCase()] });
          }
          next = `${prefix}#${tag.trim().replace(/^#/, "")}${suffix}`;
          break;
        }
        default:
          return;
      }

      bodyRef.current = next;
      onChange({ body: next });
      requestAnimationFrame(() => {
        area.focus();
        area.selectionStart = area.selectionEnd = area.value.length;
      });
    };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const isMod = event.ctrlKey || event.metaKey;
      if (!isMod) return;

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        onSaveStateChange("saving");
        setSaveState("saving");
        window.setTimeout(() => {
          setSaveState("saved");
          onSaveStateChange("saved");
          toast("Journal saved");
        }, 120);
        return;
      }
      if (event.key.toLowerCase() === "b") {
        event.preventDefault();
        applyFormat("bold");
        return;
      }
      if (event.key.toLowerCase() === "i") {
        event.preventDefault();
        applyFormat("italic");
        return;
      }
      if (event.key.toLowerCase() === "u") {
        event.preventDefault();
        applyFormat("underline");
        return;
      }
      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        applyFormat("link");
        return;
      }
    };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = event.target.value;
      bodyRef.current = next;
      lastSentBody.current = next;
      setDraft(next);
      onChange({ body: next });
      setSaveState("saving");
      onSaveStateChange("saving");
      if (autosaveRef.current) clearTimeout(autosaveRef.current);
      autosaveRef.current = setTimeout(() => {
        setSaveState("saved");
        onSaveStateChange("saved");
      }, 700);
    };

    React.useEffect(() => {
      return () => {
        if (autosaveRef.current) clearTimeout(autosaveRef.current);
      };
    }, []);

    const blocks = React.useMemo(() => parseBlocks(entry.body), [entry.body]);

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-line bg-surface-2 p-1">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => applyFormat(tool.id)}
              className="grid size-8 place-items-center rounded-md text-ink-3 hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label={tool.label}
              title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
            >
              <tool.icon className="size-4" aria-hidden />
            </button>
          ))}
          <span aria-live="polite" className="ml-auto pr-2 text-xs text-ink-3">
            {saveState === "saving" ? "Saving…" : saveState === "error" ? "Could not save" : "Saved just now"}
          </span>
        </div>

        <label className="sr-only" htmlFor={`journal-title-${entry.id}`}>
          Journal title
        </label>
        <input
          id={`journal-title-${entry.id}`}
          value={entry.title}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder="Thursday, October 8, 2026"
          className="w-full border-0 bg-transparent p-0 text-2xl font-semibold tracking-tight text-ink placeholder:text-ink-3 focus:outline-none"
        />

        <label className="sr-only" htmlFor={`journal-body-${entry.id}`}>
          Journal entry
        </label>
        <textarea
          id={`journal-body-${entry.id}`}
          ref={textareaRef}
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={16}
          placeholder="What happened today?"
          className="min-h-72 w-full resize-y rounded-xl border border-line bg-surface p-4 leading-relaxed text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />

        <div className="sr-only" aria-hidden>
          {blocks.map((block) => (
            <span key={block.id}>{block.content}</span>
          ))}
        </div>
      </div>
    );
  },
);

export function parseBlocks(body: string): NoteBlock[] {
  const lines = body.split("\n");
  const blocks: NoteBlock[] = [];
  for (const line of lines) {
    const content = line.trim();
    if (!content) continue;
    if (content.startsWith("# ")) {
      blocks.push({ id: newId(), type: "heading", content: content.slice(2) });
    } else if (content.startsWith("## ")) {
      blocks.push({ id: newId(), type: "heading", content: content.slice(3) });
    } else if (content.startsWith("- [ ] ") || content.startsWith("- [x] ")) {
      blocks.push({ id: newId(), type: "checkList", content });
    } else if (content.startsWith("- ")) {
      blocks.push({ id: newId(), type: "bulletList", content: content.slice(2) });
    } else if (/^\d+\.\s/.test(content)) {
      blocks.push({ id: newId(), type: "orderedList", content: content.replace(/^\d+\.\s/, "") });
    } else if (content.startsWith("> ")) {
      blocks.push({ id: newId(), type: "blockquote", content: content.slice(2) });
    } else if (content.startsWith("```")) {
      blocks.push({ id: newId(), type: "codeBlock", content: content.replace(/```/g, "") });
    } else if (content === "---") {
      blocks.push({ id: newId(), type: "divider", content: "" });
    } else if (content.startsWith("![")) {
      blocks.push({ id: newId(), type: "image", content });
    } else {
      blocks.push({ id: newId(), type: "paragraph", content });
    }
  }
  return blocks;
}

export function blocksToBody(blocks: NoteBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return `# ${block.content}`;
        case "bulletList":
          return `- ${block.content}`;
        case "orderedList":
          return `1. ${block.content}`;
        case "checkList":
          return `- [ ] ${block.content}`;
        case "blockquote":
          return `> ${block.content}`;
        case "codeBlock":
          return `\`\`\`\n${block.content}\n\`\`\``;
        case "divider":
          return "---";
        case "image":
          return block.content.startsWith("![") ? block.content : `![image](${block.content})`;
        default:
          return block.content;
      }
    })
    .join("\n\n");
}
