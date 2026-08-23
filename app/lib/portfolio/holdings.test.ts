import { describe, expect, it } from "vitest";
import { computeHoldingPerformance, computeHoldingsSnapshot } from "./holdings";
import { buildDailyValuations } from "./valuation";
import type { PriceHistory, Transaction } from "./types";

describe("per-holding return methodology", () => {
  it("4 — an additional BUY during the period does not create an artificial jump", () => {
    const transactions: Transaction[] = [
      { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 5, price: 100 },
      { id: "d2", date: "2026-01-03", type: "DEPOSIT", amount: 550 },
      { id: "b2", date: "2026-01-03", type: "BUY", ticker: "XYZ", shares: 5, price: 110 },
    ];
    const prices: PriceHistory = {
      XYZ: [
        { date: "2026-01-01", price: 100 },
        { date: "2026-01-02", price: 110 },
        { date: "2026-01-03", price: 110 },
      ],
    };
    const valuations = buildDailyValuations(transactions, prices, [
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
    ]);
    const perf = computeHoldingPerformance("XYZ", transactions, valuations);

    expect(perf[0].cumulativeReturnPct).toBeCloseTo(0, 6); // inception
    expect(perf[1].cumulativeReturnPct).toBeCloseTo(10, 6); // real +10% price move
    expect(perf[2].cumulativeReturnPct).toBeCloseTo(10, 6); // unchanged by the extra buy
  });

  it("5 — a partial SELL does not create an artificial return", () => {
    const transactions: Transaction[] = [
      { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 10, price: 100 },
      { id: "s1", date: "2026-01-03", type: "SELL", ticker: "XYZ", shares: 4, price: 110 },
    ];
    const prices: PriceHistory = {
      XYZ: [
        { date: "2026-01-01", price: 100 },
        { date: "2026-01-02", price: 110 },
        { date: "2026-01-03", price: 110 },
      ],
    };
    const valuations = buildDailyValuations(transactions, prices, [
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
    ]);
    const perf = computeHoldingPerformance("XYZ", transactions, valuations);

    expect(perf[1].cumulativeReturnPct).toBeCloseTo(10, 6);
    expect(perf[2].cumulativeReturnPct).toBeCloseTo(10, 6); // unchanged by the sale
  });

  it("6 — a full SELL followed by re-entry uses only the current holding period", () => {
    const transactions: Transaction[] = [
      { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 5, price: 100 },
      { id: "s1", date: "2026-01-03", type: "SELL", ticker: "XYZ", shares: 5, price: 110 },
      { id: "b2", date: "2026-01-04", type: "BUY", ticker: "XYZ", shares: 3, price: 50 },
    ];
    const prices: PriceHistory = {
      XYZ: [
        { date: "2026-01-01", price: 100 },
        { date: "2026-01-02", price: 110 },
        { date: "2026-01-03", price: 110 },
        { date: "2026-01-04", price: 50 },
        { date: "2026-01-05", price: 55 },
      ],
    };
    const valuations = buildDailyValuations(transactions, prices, [
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
      "2026-01-05",
    ]);
    const perf = computeHoldingPerformance("XYZ", transactions, valuations);

    // Only the re-entered position (from 01-04 onward) — the original
    // 01-01 lot's history must not leak into the current period.
    expect(perf.map((p) => p.date)).toEqual(["2026-01-04", "2026-01-05"]);
    expect(perf[0].cumulativeReturnPct).toBeCloseTo(0, 6);
    expect(perf[1].cumulativeReturnPct).toBeCloseTo(10, 6); // 50 -> 55
  });

  it("7 — a dividend does not affect the price-return holding metric", () => {
    const transactions: Transaction[] = [
      { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 5, price: 100 },
      { id: "div1", date: "2026-01-02", type: "DIVIDEND", ticker: "XYZ", amount: 20 },
    ];
    const prices: PriceHistory = {
      XYZ: [
        { date: "2026-01-01", price: 100 },
        { date: "2026-01-02", price: 100 }, // no price move, only a dividend
      ],
    };
    const valuations = buildDailyValuations(transactions, prices, [
      "2026-01-01",
      "2026-01-02",
    ]);
    const perf = computeHoldingPerformance("XYZ", transactions, valuations);

    expect(perf[0].cumulativeReturnPct).toBeCloseTo(0, 6);
    expect(perf[1].cumulativeReturnPct).toBeCloseTo(0, 6); // dividend excluded, not counted
  });

  it("current-position inception with no re-entry: whole history from original purchase", () => {
    const transactions: Transaction[] = [
      { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 5, price: 100 },
    ];
    const prices: PriceHistory = {
      XYZ: [
        { date: "2026-01-01", price: 100 },
        { date: "2026-01-02", price: 105 },
      ],
    };
    const valuations = buildDailyValuations(transactions, prices, [
      "2026-01-01",
      "2026-01-02",
    ]);
    const perf = computeHoldingPerformance("XYZ", transactions, valuations);
    expect(perf[0].date).toBe("2026-01-01");
    expect(perf[1].cumulativeReturnPct).toBeCloseTo(5, 6);
  });

  it("a ticker that is not currently held returns an empty performance series", () => {
    const transactions: Transaction[] = [
      { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 5, price: 100 },
      { id: "s1", date: "2026-01-02", type: "SELL", ticker: "XYZ", shares: 5, price: 100 },
    ];
    const prices: PriceHistory = {
      XYZ: [
        { date: "2026-01-01", price: 100 },
        { date: "2026-01-02", price: 100 },
      ],
    };
    const valuations = buildDailyValuations(transactions, prices, [
      "2026-01-01",
      "2026-01-02",
    ]);
    expect(computeHoldingPerformance("XYZ", transactions, valuations)).toEqual([]);
  });
});

describe("computeHoldingsSnapshot", () => {
  it("builds allocation and performance for every currently open position, sorted by allocation", () => {
    const transactions: Transaction[] = [
      { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 2000 },
      { id: "b1", date: "2026-01-01", type: "BUY", ticker: "AAA", shares: 5, price: 100 },
      { id: "b2", date: "2026-01-01", type: "BUY", ticker: "BBB", shares: 20, price: 20 },
    ];
    const prices: PriceHistory = {
      AAA: [{ date: "2026-01-01", price: 100 }, { date: "2026-01-02", price: 100 }],
      BBB: [{ date: "2026-01-01", price: 20 }, { date: "2026-01-02", price: 20 }],
    };
    const valuations = buildDailyValuations(transactions, prices, [
      "2026-01-01",
      "2026-01-02",
    ]);
    const holdings = computeHoldingsSnapshot(transactions, valuations, { AAA: "Company A" });

    expect(holdings.map((h) => h.ticker)).toEqual(["AAA", "BBB"]); // AAA=500, BBB=400 -> AAA first
    expect(holdings[0].name).toBe("Company A");
    expect(holdings[1].name).toBe("BBB"); // no name supplied -> falls back to ticker
    expect(holdings[0].allocationPct + holdings[1].allocationPct).toBeCloseTo(100, 6);
  });
});
