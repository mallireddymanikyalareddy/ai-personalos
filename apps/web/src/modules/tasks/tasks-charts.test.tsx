import * as React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TaskBreakdownRow, TaskStatusSegment } from "@personalos/core";

import { CompletionDonut, PriorityDonut, ProjectBars, StatusBars } from "./tasks-charts";

vi.mock("recharts", async (importOriginal) => {
  const ReactModule = await import("react");
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement<{ width?: number; height?: number }> }) =>
      ReactModule.cloneElement(children, { width: 480, height: 200 }),
  };
});

afterEach(cleanup);

const projects: TaskBreakdownRow[] = [
  { key: "Support", label: "Support", count: 12, color: "var(--chart-5)", pct: 40 },
  { key: "Personal", label: "Personal", count: 6, color: "var(--chart-4)", pct: 20 },
  { key: "Projects", label: "Projects", count: 4, color: "var(--chart-6)", pct: 13 },
];

const priorities: TaskBreakdownRow[] = [
  { key: "3", label: "High", count: 8, color: "var(--danger)", pct: 29 },
  { key: "2", label: "Medium", count: 12, color: "var(--warning)", pct: 43 },
  { key: "1", label: "Low", count: 8, color: "var(--success)", pct: 29 },
];

const statuses: TaskStatusSegment[] = [
  { key: "completed", label: "Completed", count: 18, color: "var(--success)" },
  { key: "inProgress", label: "In Progress", count: 5, color: "var(--info)" },
  { key: "notStarted", label: "Not Started", count: 4, color: "var(--chart-8)" },
  { key: "overdue", label: "Overdue", count: 2, color: "var(--danger)" },
];

function sectorPaths(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll("path.recharts-sector"));
}

function hasGeometry(node: Element): boolean {
  return (node.getAttribute("d") ?? "").length > 0;
}

describe("ProjectBars", () => {
  it("draws one filled bar per project with a proportional width", () => {
    const { container } = render(<ProjectBars rows={projects} />);
    const rows = container.querySelectorAll('[data-testid="tasks-project-bar"]');
    const fills = container.querySelectorAll<HTMLElement>('[data-testid="tasks-project-bar-fill"]');
    expect(rows).toHaveLength(projects.length);
    expect(fills).toHaveLength(projects.length);
    for (const fill of fills) {
      expect(fill.style.width).toMatch(/%$/);
    }
    expect(fills[0]!.style.width).toBe("100%");
  });

  it("explains itself when there are no projects", () => {
    const { getByText } = render(<ProjectBars rows={[]} />);
    expect(getByText("No projects yet.")).toBeDefined();
  });
});

describe("PriorityDonut", () => {
  it("draws a sector per priority slice", () => {
    const { container } = render(<PriorityDonut rows={priorities} total={28} />);
    const sectors = sectorPaths(container);
    expect(sectors).toHaveLength(priorities.length);
    expect(sectors.every(hasGeometry)).toBe(true);
  });

  it("shows the total in the middle", () => {
    const { getByTestId, getByText } = render(<PriorityDonut rows={priorities} total={28} />);
    expect(getByTestId("tasks-priority-donut")).toBeDefined();
    expect(getByText("28")).toBeDefined();
  });
});

describe("StatusBars", () => {
  it("draws a bar for each status segment with a proportional height", () => {
    const { container } = render(<StatusBars segments={statuses} />);
    const bars = container.querySelectorAll<HTMLElement>('[data-testid="tasks-status-bar"]');
    expect(bars).toHaveLength(statuses.length);
    for (const bar of bars) {
      expect(bar.style.height).toMatch(/%$/);
    }
    expect(bars[0]!.style.height).toBe("100%");
  });

  it("explains itself with no status data", () => {
    const { getByText } = render(<StatusBars segments={[]} />);
    expect(getByText("No status data yet.")).toBeDefined();
  });
});

describe("CompletionDonut", () => {
  it("draws the achieved arc and the remainder ring", () => {
    const { container } = render(<CompletionDonut rate={78} segments={statuses} />);
    const sectors = sectorPaths(container);
    expect(sectors).toHaveLength(2);
    expect(sectors.every(hasGeometry)).toBe(true);
    expect(sectors[0]!.getAttribute("fill")).toBe("var(--success)");
  });

  it("still draws the ring at zero percent", () => {
    const { container } = render(<CompletionDonut rate={0} segments={statuses} />);
    const sectors = sectorPaths(container);
    expect(sectors.length).toBeGreaterThanOrEqual(1);
    expect(sectors.every(hasGeometry)).toBe(true);
  });
});