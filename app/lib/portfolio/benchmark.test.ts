import { describe, expect, it } from "vitest";
import { computeBenchmarkReturn } from "./benchmark";

describe("M — benchmark rebasing", () => {
  it("rebases a total-return series to 0% at inception", () => {
    const result = computeBenchmarkReturn([
      { date: "2026-01-01", value: 100 },
      { date: "2026-01-02", value: 105 },
      { date: "2026-01-03", value: 110 },
    ]);

    expect(result[0].cumulativeReturnPct).toBeCloseTo(0, 6);
    expect(result[1].cumulativeReturnPct).toBeCloseTo(5, 6);
    expect(result[2].cumulativeReturnPct).toBeCloseTo(10, 6);
  });

  it("rejects a series that doesn't start from a positive value", () => {
    expect(() => computeBenchmarkReturn([{ date: "2026-01-01", value: 0 }])).toThrow();
  });

  it("returns an empty series for empty input", () => {
    expect(computeBenchmarkReturn([])).toEqual([]);
  });
});
