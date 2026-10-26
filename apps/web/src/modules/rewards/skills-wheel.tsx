"use client";

import * as React from "react";

import { SKILL_DEFINITIONS, xpForLevel, type SkillLevels } from "@personalos/core";

const LEVEL_COLORS = [
  "var(--chart-8)",
  "var(--chart-2)",
  "var(--chart-5)",
  "var(--chart-1)",
  "var(--chart-4)",
  "var(--chart-3)",
];

const SHORT_LABELS: Record<string, string> = {
  execution: "Exec",
  consistency: "Cons",
  focus: "Focus",
  planning: "Plan",
  knowledge: "Know",
  wellbeing: "Well",
};

const NODE_RADIUS = 25;
const RING_RADIUS = 74;
const CENTER_X = 150;
const CENTER_Y = 118;

function levelColor(level: number): string {
  return LEVEL_COLORS[Math.min(Math.max(level, 1), LEVEL_COLORS.length) - 1]!;
}

function hexagonPoints(cx: number, cy: number, radius: number): string {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 180) * (60 * index - 90);
    return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");
}

export interface SkillsWheelProps {
  skills: SkillLevels;
  level: number;
  title: string;
}

export function SkillsWheel({ skills, level, title }: SkillsWheelProps) {
  const nodes = SKILL_DEFINITIONS.map((definition, index) => {
    const entry = skills[definition.kind] ?? { level: 1, xp: 0 };
    const angle = (Math.PI / 180) * (60 * index - 90);
    return {
      kind: definition.kind,
      label: definition.label,
      short: SHORT_LABELS[definition.kind] ?? definition.label.slice(0, 4),
      level: entry.level,
      xp: entry.xp,
      x: CENTER_X + RING_RADIUS * Math.cos(angle),
      y: CENTER_Y + RING_RADIUS * Math.sin(angle),
    };
  });

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 300 236"
        role="img"
        aria-label={`Skill wheel. Overall level ${level}, ${title}.`}
        className="w-full max-w-[280px]"
        data-testid="rewards-skills-wheel"
      >
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={40}
          fill="none"
          stroke="var(--line)"
          strokeWidth={1}
        />
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={33}
          fill="var(--surface-2)"
          stroke="var(--line-strong)"
          strokeWidth={1}
        />
        <text
          x={CENTER_X}
          y={CENTER_Y - 14}
          textAnchor="middle"
          className="fill-ink-3"
          style={{ fontSize: 9, letterSpacing: "0.08em" }}
        >
          LEVEL
        </text>
        <text
          x={CENTER_X}
          y={CENTER_Y + 16}
          textAnchor="middle"
          className="fill-ink"
          style={{ fontSize: 22, fontWeight: 700 }}
          data-testid="rewards-skills-level"
        >
          {level}
        </text>

        {nodes.map((node) => {
          const color = levelColor(node.level);
          const nextAt = xpForLevel(node.level + 1);
          const current = xpForLevel(node.level);
          const ratio = nextAt > current ? Math.min(1, Math.max(0, (node.xp - current) / (nextAt - current))) : 1;
          return (
            <g key={node.kind} data-testid={`rewards-skills-node-${node.kind}`}>
              <title>{`${node.label} · Level ${node.level} · ${node.xp} XP`}</title>
              <polygon
                points={hexagonPoints(node.x, node.y, NODE_RADIUS)}
                fill={color}
                fillOpacity={0.12 + ratio * 0.28}
                stroke={color}
                strokeWidth={1.5}
                style={{ transition: "fill-opacity 200ms ease" }}
              />
              <text
                x={node.x}
                y={node.y - 3}
                textAnchor="middle"
                className="fill-ink-3"
                style={{ fontSize: 9, letterSpacing: "0.06em" }}
              >
                {node.short.toUpperCase()}
              </text>
              <text
                x={node.x}
                y={node.y + 14}
                textAnchor="middle"
                style={{ fontSize: 14, fontWeight: 700, fill: color }}
              >
                {node.level}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="mt-1 text-center text-[11px] text-ink-3" data-testid="rewards-skills-caption">
        Level {level} · {title}
      </p>

      <ul className="mt-2 w-full space-y-1">
        {nodes.map((node) => {
          const color = levelColor(node.level);
          return (
            <li
              key={node.kind}
              data-testid="rewards-skill"
              className="flex items-center gap-2 text-[11px]"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: color }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-ink-2">{node.label}</span>
              <span className="shrink-0 tabular-nums text-ink-3">Lv {node.level}</span>
              <span className="w-14 shrink-0 text-right tabular-nums text-ink-3">{node.xp} XP</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
