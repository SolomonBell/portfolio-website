import { describe, expect, it } from "vitest";
import { assemblePerformancePoints } from "./assemble";

describe("assemblePerformancePoints", () => {
  it("zips portfolio + benchmark series into the PerformancePoint contract", () => {
    const result = assemblePerformancePoints(
      [{ date: "2026-01-01", cumulativeReturnPct: 0 }, { date: "2026-01-02", cumulativeReturnPct: 10 }],
      [{ date: "2026-01-01", cumulativeReturnPct: 0 }, { date: "2026-01-02", cumulativeReturnPct: 5 }],
      [{ date: "2026-01-01", cumulativeReturnPct: 0 }, { date: "2026-01-02", cumulativeReturnPct: 8 }]
    );
    expect(result).toEqual([
      { date: "2026-01-01", portfolio: 0, spy: 0, qqq: 0 },
      { date: "2026-01-02", portfolio: 10, spy: 5, qqq: 8 },
    ]);
  });

  it("throws on mismatched series lengths", () => {
    expect(() =>
      assemblePerformancePoints(
        [{ date: "2026-01-01", cumulativeReturnPct: 0 }],
        [],
        [{ date: "2026-01-01", cumulativeReturnPct: 0 }]
      )
    ).toThrow();
  });

  it("throws on mismatched dates at the same index", () => {
    expect(() =>
      assemblePerformancePoints(
        [{ date: "2026-01-01", cumulativeReturnPct: 0 }],
        [{ date: "2026-01-02", cumulativeReturnPct: 0 }],
        [{ date: "2026-01-01", cumulativeReturnPct: 0 }]
      )
    ).toThrow();
  });
});
