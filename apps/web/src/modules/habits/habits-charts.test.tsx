import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HabitMonthPoint } from "@personalos/core";

import { SuccessDonut, SuccessLine } from "./habits-charts";

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

const rising: HabitMonthPoint[] = [
  { key: "2026-10-1", label: "Oct 1", day: 1, rate: 40, done: 2, due: 5 },
  { key: "2026-10-2", label: "Oct 2", day: 2, rate: 60, done: 3, due: 5 },
  { key: "2026-10-3", label: "Oct 3", day: 3, rate: 80, done: 4, due: 5 },
  { key: "2026-10-4", label: "Oct 4", day: 4, rate: 100, done: 5, due: 5 },
];

function linePath(container: HTMLElement): SVGPathElement {
  const path = container.querySelector<SVGPathElement>("path.recharts-line-curve");
  expect(path).not.toBeNull();
  return path as SVGPathElement;
}

function yValues(path: SVGPathElement): number[] {
  const d = path.getAttribute("d") ?? "";
  const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  return numbers.filter((_, index) => index % 2 === 1);
}

describe("SuccessLine", () => {
  it("draws a line whose vertical geometry varies with the data", () => {
    const { container } = render(<SuccessLine points={rising} />);
    const path = linePath(container);

    expect((path.getAttribute("d") ?? "").length).toBeGreaterThan(0);
    expect(new Set(yValues(path)).size).toBeGreaterThan(1);
  });

  it("still draws a path for a flat all-zero month", () => {
    const flat = rising.map((point) => ({ ...point, rate: 0 }));
    const { container } = render(<SuccessLine points={flat} />);
    const path = linePath(container);

    expect((path.getAttribute("d") ?? "").length).toBeGreaterThan(0);
    expect(new Set(yValues(path)).size).toBe(1);
  });

  it("explains itself when the month has no data", () => {
    render(<SuccessLine points={[]} />);
    expect(screen.getByText("No check-ins recorded this month yet.")).toBeDefined();
  });
});

describe("SuccessDonut", () => {
  it("renders a filled arc for the achieved share and the remainder", () => {
    const { container } = render(<SuccessDonut rate={78} />);
    const arcs = container.querySelectorAll("path.recharts-sector");
    expect(arcs).toHaveLength(2);
    for (const arc of arcs) {
      expect((arc.getAttribute("d") ?? "").length).toBeGreaterThan(0);
    }
    expect(arcs[0]!.getAttribute("fill")).toBe("var(--chart-3)");
  });

  it("still draws the ring when the month is at zero percent", () => {
    const { container } = render(<SuccessDonut rate={0} />);
    const arcs = container.querySelectorAll("path.recharts-sector");
    expect(arcs).toHaveLength(1);
    expect((arcs[0]!.getAttribute("d") ?? "").length).toBeGreaterThan(0);
    expect(arcs[0]!.getAttribute("fill")).toBe("var(--surface-3)");
  });
});