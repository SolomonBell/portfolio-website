import { describe, expect, it } from "vitest";
import { getRangeForPerformance } from "./range";
import type { PerformancePoint } from "../investing";

describe("N — range rebasing uses correct compounding, not naive subtraction", () => {
  it("rebases a later start date to the mathematically correct return", () => {
    // Each series is two consecutive +10%/+5%/+8% compounding steps, so
    // the *correctly* rebased second step exactly reproduces the first
    // step's value (10 / 5 / 8) — a naive `end - start` subtraction would
    // instead (wrongly) give 11 / 5.25 / 8.64.
    const points: PerformancePoint[] = [
      { date: "2026-01-01", portfolio: 0, spy: 0, qqq: 0 },
      { date: "2026-01-02", portfolio: 10, spy: 5, qqq: 8 },
      { date: "2026-01-03", portfolio: 21, spy: 10.25, qqq: 16.64 },
    ];

    // range="Max" + inceptionDate="2026-01-02" pins the clamped start
    // exactly at the second point, isolating the rebase step under test.
    const result = getRangeForPerformance(points, "Max", "2026-01-03", "2026-01-02");

    expect(result).toHaveLength(2);
    expect(result[0].portfolio).toBeCloseTo(0, 6);
    expect(result[1].portfolio).toBeCloseTo(10, 6);
    expect(result[1].spy).toBeCloseTo(5, 6);
    expect(result[1].qqq).toBeCloseTo(8, 6);
  });
});

describe("O — portfolio younger than the selected range", () => {
  const points: PerformancePoint[] = [
    { date: "2026-06-01", portfolio: 0, spy: 0, qqq: 0 },
    { date: "2026-07-01", portfolio: 5, spy: 2, qqq: 3 },
    { date: "2026-08-01", portfolio: 8, spy: 4, qqq: 6 },
  ];
  const inceptionDate = "2026-06-01";

  it("clamps a 1Y request to inception instead of generating pre-inception performance", () => {
    const result = getRangeForPerformance(points, "1Y", "2026-08-01", inceptionDate);
    expect(result).toHaveLength(3);
    expect(result[0].date).toBe(inceptionDate);
  });

  it("clamps a 5Y request to inception the same way", () => {
    const result = getRangeForPerformance(points, "5Y", "2026-08-01", inceptionDate);
    expect(result).toHaveLength(3);
    expect(result[0].date).toBe(inceptionDate);
  });

  it("starts portfolio and both benchmarks at 0% on the same common date", () => {
    const result = getRangeForPerformance(points, "1Y", "2026-08-01", inceptionDate);
    expect(result[0].portfolio).toBeCloseTo(0, 6);
    expect(result[0].spy).toBeCloseTo(0, 6);
    expect(result[0].qqq).toBeCloseTo(0, 6);
  });
});
