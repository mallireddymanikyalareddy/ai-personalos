"use client";

import { Eraser, Highlighter, Lasso, MousePointer2, Pencil, Shapes } from "lucide-react";

import { HIGHlighter_COLORS, PAPER_COLORS, type PaperToolKind } from "@personalos/core";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const TOOLS: Array<{ value: PaperToolKind; label: string; hint: string; icon: React.ReactNode }> = [
  { value: "pen", label: "Pen", hint: "Pressure-sensitive ink", icon: <Pencil className="size-4" /> },
  { value: "pencil", label: "Pencil", hint: "Textured graphite", icon: <Pencil className="size-4" /> },
  { value: "highlighter", label: "Highlighter", hint: "Multiply blend", icon: <Highlighter className="size-4" /> },
  { value: "marker", label: "Marker", hint: "Soft broad tip", icon: <MousePointer2 className="size-4" /> },
  { value: "shapes", label: "Shapes", hint: "Auto-recognises", icon: <Shapes className="size-4" /> },
  { value: "eraser", label: "Eraser", hint: "Removes strokes", icon: <Eraser className="size-4" /> },
  { value: "lasso", label: "Lasso", hint: "Select strokes", icon: <Lasso className="size-4" /> },
];

const WIDTHS = [1, 2, 3, 6, 12, 24];

export interface PaperToolbarProps {
  tool: PaperToolKind;
  color: string;
  width: number;
  opacity: number;
  onToolChange: (tool: PaperToolKind) => void;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  onOpacityChange: (opacity: number) => void;
}

export function PaperToolbar({
  tool,
  color,
  width,
  opacity,
  onToolChange,
  onColorChange,
  onWidthChange,
  onOpacityChange,
}: PaperToolbarProps) {
  const isHighlighter = tool === "highlighter";
  const palette = isHighlighter ? [...HIGHlighter_COLORS] : [...PAPER_COLORS];

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-2.5 shadow-card">
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Tool">
        {TOOLS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            role="radio"
            aria-checked={tool === entry.value}
            title={`${entry.label} — ${entry.hint}`}
            aria-label={entry.label}
            onClick={() => onToolChange(entry.value)}
            className={cn(
              "grid size-9 place-items-center rounded-lg transition-colors",
              tool === entry.value
                ? "bg-accent text-white"
                : "text-ink-3 hover:bg-surface-2 hover:text-ink",
            )}
          >
            {entry.icon}
          </button>
        ))}
      </div>

      <div className="h-8 w-px bg-line" role="separator" />

      <div className="flex items-center gap-1" role="radiogroup" aria-label="Ink colour">
        {palette.map((value, index) => (
          <button
            key={`${value}-${index}`}
            type="button"
            role="radio"
            aria-checked={color === value}
            aria-label={`Colour ${index + 1}`}
            title={value}
            onClick={() => onColorChange(value)}
            className={cn(
              "size-6 rounded-full border transition-transform",
              color === value ? "border-ink scale-110" : "border-line-strong",
            )}
            style={{ backgroundColor: value }}
          />
        ))}
      </div>

      <div className="h-8 w-px bg-line" role="separator" />

      <div className="flex items-center gap-1" role="radiogroup" aria-label="Stroke width">
        {WIDTHS.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={width === value}
            aria-label={`Width ${value}`}
            onClick={() => onWidthChange(value)}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-lg border transition-colors",
              width === value ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-2",
            )}
          >
            <span
              className="rounded-full bg-ink"
              style={{ width: value, height: Math.min(16, Math.max(2, value)) }}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-3">Opacity</span>
        <input
          type="range"
          min={0.05}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(event) => onOpacityChange(Number(event.target.value))}
          aria-label="Ink opacity"
          className="w-20 accent-[var(--accent)]"
        />
        <span className="w-8 text-xs tabular-nums text-ink-3">{Math.round(opacity * 100)}%</span>
      </div>

      <div className="ml-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onToolChange("pen");
            onColorChange("#111827");
            onWidthChange(3);
            onOpacityChange(1);
          }}
        >
          Reset ink
        </Button>
      </div>
    </div>
  );
}