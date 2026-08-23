import { describe, expect, it } from "vitest";
import {
  getHoldingReturnForRange,
  mockPortfolio,
  type Holding,
  type HoldingPerformancePoint,
} from "./investing";

function holdingWith(performance: HoldingPerformancePoint[]): Holding {
  return { ticker: "TEST", name: "Test Co.", allocationPct: 12.5, performance };
}

describe("1 — holding owned before the selected window", () => {
  it("clamps to the range's nominal start, not the holding's full history", () => {
    // Two consecutive +10% compounding steps, so a correct rebase from
    // the later point gives +10% (not the naive-subtraction 11%, and
    // not the full-history +21%).
    const holding = holdingWith([
      { date: "2026-01-01", cumulativeReturnPct: 0 }, // holding inception, well before the window
      { date: "2026-07-21", cumulativeReturnPct: 10 }, // "1M" range's nominal start
      { date: "2026-08-21", cumulativeReturnPct: 21 }, // asOfDate
    ]);

    const result = getHoldingReturnForRange(holding, "1M", "2026-08-21");
    expect(result).toBeCloseTo(10, 6);
  });
});

describe("2 — holding purchased during the selected window", () => {
  const holding = holdingWith([
    { date: "2026-06-01", cumulativeReturnPct: 0 }, // purchased ~2.5 months before asOfDate
    { date: "2026-08-21", cumulativeReturnPct: 8 },
  ]);

  it("returns since the holding's own inception, not a full 1Y", () => {
    // Selecting 1Y (nominal start ~2025-08-21) must not pretend the
    // holding was owned for the full year — matches the AAPL example.
    expect(getHoldingReturnForRange(holding, "1Y", "2026-08-21")).toBeCloseTo(8, 6);
  });
});

describe("3 — Max starts at holding inception", () => {
  it("gives the same result as any range whose nominal start predates the holding", () => {
    const holding = holdingWith([
      { date: "2026-06-01", cumulativeReturnPct: 0 },
      { date: "2026-08-21", cumulativeReturnPct: 8 },
    ]);
    expect(getHoldingReturnForRange(holding, "Max", "2026-08-21")).toBeCloseTo(8, 6);
  });
});

describe("8 — different selected ranges return different correct values", () => {
  const holding = holdingWith([
    { date: "2026-01-01", cumulativeReturnPct: 0 },
    { date: "2026-07-21", cumulativeReturnPct: 10 },
    { date: "2026-08-21", cumulativeReturnPct: 21 },
  ]);

  it("1M and Max resolve to different, individually correct values", () => {
    expect(getHoldingReturnForRange(holding, "1M", "2026-08-21")).toBeCloseTo(10, 6);
    expect(getHoldingReturnForRange(holding, "Max", "2026-08-21")).toBeCloseTo(21, 6);
  });
});

describe("9 — allocation is unaffected by the selected timeframe", () => {
  it("holding.allocationPct never changes across getHoldingReturnForRange calls", () => {
    const holding = holdingWith([
      { date: "2026-01-01", cumulativeReturnPct: 0 },
      { date: "2026-08-21", cumulativeReturnPct: 12 },
    ]);
    const before = holding.allocationPct;
    for (const range of ["5D", "1M", "6M", "YTD", "1Y", "5Y", "Max"] as const) {
      getHoldingReturnForRange(holding, range, "2026-08-21");
      expect(holding.allocationPct).toBe(before);
    }
  });
});

describe("10 — placeholder (mock) holdings update deterministically with the selected range", () => {
  it("a long-held mock holding (NVDA) differs across ranges, deterministically", () => {
    const nvda = mockPortfolio.holdings.find((h) => h.ticker === "NVDA");
    expect(nvda).toBeDefined();
    if (!nvda) return;

    const oneMonth = getHoldingReturnForRange(nvda, "1M", mockPortfolio.asOfDate);
    const oneYear = getHoldingReturnForRange(nvda, "1Y", mockPortfolio.asOfDate);
    expect(oneMonth).not.toBeNull();
    expect(oneYear).not.toBeNull();
    expect(oneMonth).not.toBeCloseTo(oneYear as number, 3);

    // Calling again with the same range gives the identical value — no
    // per-render randomness.
    expect(getHoldingReturnForRange(nvda, "1M", mockPortfolio.asOfDate)).toBe(oneMonth);
  });

  it("a recently-added mock holding (JPM) clamps 1Y and Max to the same value", () => {
    const jpm = mockPortfolio.holdings.find((h) => h.ticker === "JPM");
    expect(jpm).toBeDefined();
    if (!jpm) return;

    // JPM's mock inception is only ~2 months before asOfDate, so both a
    // 1Y and a Max request should clamp to that same actual inception
    // date and produce the identical return.
    const oneYear = getHoldingReturnForRange(jpm, "1Y", mockPortfolio.asOfDate);
    const max = getHoldingReturnForRange(jpm, "Max", mockPortfolio.asOfDate);
    expect(oneYear).toBeCloseTo(max as number, 6);
  });
});

describe("11 — no fabricated real 1D holding value", () => {
  it("returns null for 1D on a constructed holding", () => {
    const holding = holdingWith([
      { date: "2026-08-20", cumulativeReturnPct: 0 },
      { date: "2026-08-21", cumulativeReturnPct: 1.2 },
    ]);
    expect(getHoldingReturnForRange(holding, "1D", "2026-08-21")).toBeNull();
  });

  it("returns null for 1D on every real placeholder holding", () => {
    for (const holding of mockPortfolio.holdings) {
      expect(getHoldingReturnForRange(holding, "1D", mockPortfolio.asOfDate)).toBeNull();
    }
  });
});
