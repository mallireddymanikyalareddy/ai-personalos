"use client";

import * as React from "react";

import { cn } from "@/lib/cn";

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "code"; text: string };

function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^)]+\))/g;
  return text.split(pattern).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={key} className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[0.92em] text-ink">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (link) {
      return (
        <a key={key} href={link[2]} target="_blank" rel="noreferrer noopener" className="text-accent-ink underline underline-offset-2">
          {link[1]}
        </a>
      );
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

function parse(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index]!;
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index]!.trim().startsWith("```")) {
        code.push(lines[index]!);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ kind: "code", text: code.join("\n") });
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1]!.length, text: heading[2]!.trim() });
      index += 1;
      continue;
    }
    if (/^\s*([-*•])\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*([-*•])\s+/.test(lines[index]!)) {
        items.push(lines[index]!.replace(/^\s*([-*•])\s+/, ""));
        index += 1;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index]!)) {
        items.push(lines[index]!.replace(/^\s*\d+[.)]\s+/, ""));
        index += 1;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index]!)) {
        quote.push(lines[index]!.replace(/^\s*>\s?/, ""));
        index += 1;
      }
      blocks.push({ kind: "quote", text: quote.join(" ") });
      continue;
    }
    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length) {
      const next = lines[index]!;
      if (!next.trim() || /^(#{1,4})\s+/.test(next) || /^\s*([-*•])\s+/.test(next) ||
          /^\s*\d+[.)]\s+/.test(next) || /^\s*>\s?/.test(next) || next.trim().startsWith("```")) {
        break;
      }
      paragraph.push(next);
      index += 1;
    }
    blocks.push({ kind: "paragraph", text: paragraph.join("\n") });
  }
  return blocks;
}

export function AIAnswer({
  text,
  className,
  testId,
  role,
}: {
  text: string;
  className?: string;
  testId?: string;
  role?: string;
}) {
  const blocks = React.useMemo(() => parse(text), [text]);
  return (
    <div
      data-testid={testId}
      role={role}
      className={cn("space-y-2 text-[13px] leading-relaxed text-ink-2", className)}
    >
      {blocks.map((block, index) => {
        const key = `block-${index}`;
        if (block.kind === "heading") {
          return (
            <p key={key} className={cn("font-semibold text-ink", block.level <= 2 ? "text-[15px]" : "text-[13px]")}>
              {inline(block.text, key)}
            </p>
          );
        }
        if (block.kind === "ul") {
          return (
            <ul key={key} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>{inline(item, `${key}-${itemIndex}`)}</li>
              ))}
            </ul>
          );
        }
        if (block.kind === "ol") {
          return (
            <ol key={key} className="list-decimal space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>{inline(item, `${key}-${itemIndex}`)}</li>
              ))}
            </ol>
          );
        }
        if (block.kind === "quote") {
          return (
            <blockquote key={key} className="border-l-2 border-line pl-3 text-ink-3">
              {inline(block.text, key)}
            </blockquote>
          );
        }
        if (block.kind === "code") {
          return (
            <pre key={key} className="overflow-x-auto rounded-lg bg-surface-3 p-3 font-mono text-[12px] text-ink">
              <code>{block.text}</code>
            </pre>
          );
        }
        return (
          <p key={key} className="whitespace-pre-wrap">
            {inline(block.text, key)}
          </p>
        );
      })}
    </div>
  );
}
