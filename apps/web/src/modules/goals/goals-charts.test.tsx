import * as React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GoalTimelinePoint } from "@personalos/core";

import { ProgressLine } from "./goals-charts";

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

const points: GoalTimelinePoint[] = [
  { key: "2026-9", label: "Sep 26", progress: 0 },
  { key: "2026-10", label: "Oct 26", progress: 20 },
  { key: "2026-11", label: "Nov 26", progress: 55 },
  { key: "2026-12", label: "Dec 26", progress: 80 },
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

describe("ProgressLine", () => {
  it("draws a line whose vertical geometry varies with the data", () => {
    const { container } = render(<ProgressLine points={points} />);
    const path = linePath(container);
    const ys = yValues(path);

    expect((path.getAttribute("d") ?? "").length).toBeGreaterThan(0);
    expect(new Set(ys).size).toBeGreaterThan(1);
  });

  it("draws a path even when every point is a flat zero series", () => {
    const flat = points.map((point) => ({ ...point, progress: 0 }));
    const { container } = render(<ProgressLine points={flat} />);
    const path = linePath(container);
    const ys = yValues(path);

    expect((path.getAttribute("d") ?? "").length).toBeGreaterThan(0);
    expect(new Set(ys).size).toBe(1);
  });
});
