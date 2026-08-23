import { describe, expect, it } from "vitest";
import { computePriceReturnTWR, computeTWR } from "./twr";
import { buildDailyValuations } from "./valuation";
import { computeBenchmarkReturn } from "./benchmark";
import type { Transaction } from "./types";

describe("13 — dividend exclusion from the public price-return comparison", () => {
  it("computeTWR counts a dividend as return; computePriceReturnTWR excludes it", () => {
    const transactions: Transaction[] = [
      { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 10, price: 100 },
      { id: "div1", date: "2026-01-02", type: "DIVIDEND", ticker: "XYZ", amount: 20 },
    ];
    const valuations = buildDailyValuations(
      transactions,
      { XYZ: [{ date: "2026-01-01", price: 100 }, { date: "2026-01-02", price: 100 }] },
      ["2026-01-01", "2026-01-02"]
    );

    const accountTWR = computeTWR(valuations);
    const priceReturnTWR = computePriceReturnTWR(valuations);

    expect(accountTWR[1].cumulativeReturnPct).toBeCloseTo(2, 6); // dividend counted
    expect(priceReturnTWR[1].cumulativeReturnPct).toBeCloseTo(0, 6); // dividend excluded
  });

  it("does not affect price-return TWR when there is real price appreciation alongside a dividend", () => {
    const transactions: Transaction[] = [
      { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 10, price: 100 },
      { id: "div1", date: "2026-01-02", type: "DIVIDEND", ticker: "XYZ", amount: 20 },
    ];
    const valuations = buildDailyValuations(
      transactions,
      { XYZ: [{ date: "2026-01-01", price: 100 }, { date: "2026-01-02", price: 110 }] },
      ["2026-01-01", "2026-01-02"]
    );

    // totalValue day 2 = cash(20) + 10*110 = 1120. Account TWR counts all
    // of it (+12%); price-return TWR excludes only the $20 dividend
    // (still counts the $100 of price appreciation, so +10%).
    expect(computeTWR(valuations)[1].cumulativeReturnPct).toBeCloseTo(12, 6);
    expect(computePriceReturnTWR(valuations)[1].cumulativeReturnPct).toBeCloseTo(10, 6);
  });

  it("deposits and withdrawals are excluded from both metrics identically", () => {
    const transactions: Transaction[] = [
      { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 10, price: 100 },
      { id: "d2", date: "2026-01-02", type: "DEPOSIT", amount: 500 },
    ];
    const valuations = buildDailyValuations(
      transactions,
      { XYZ: [{ date: "2026-01-01", price: 100 }, { date: "2026-01-02", price: 100 }] },
      ["2026-01-01", "2026-01-02"]
    );
    expect(computeTWR(valuations)[1].cumulativeReturnPct).toBeCloseTo(0, 6);
    expect(computePriceReturnTWR(valuations)[1].cumulativeReturnPct).toBeCloseTo(0, 6);
  });
});

describe("12 — price-return benchmark calculation", () => {
  it("a Close-only benchmark series is inherently price return, consistent with the portfolio's price-return metric", () => {
    // SPY-like series with no dividend adjustment baked in (Close only).
    const spyClose = [
      { date: "2026-01-01", value: 450 },
      { date: "2026-01-02", value: 459 }, // +2%
    ];
    const benchmark = computeBenchmarkReturn(spyClose);
    expect(benchmark[1].cumulativeReturnPct).toBeCloseTo(2, 6);

    // Portfolio side, price-return, over the same window and same
    // magnitude of price move, with a dividend that must NOT leak in.
    const transactions: Transaction[] = [
      { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 10, price: 100 },
      { id: "div1", date: "2026-01-02", type: "DIVIDEND", ticker: "XYZ", amount: 50 },
    ];
    const valuations = buildDailyValuations(
      transactions,
      { XYZ: [{ date: "2026-01-01", price: 100 }, { date: "2026-01-02", price: 102 }] },
      ["2026-01-01", "2026-01-02"]
    );
    const portfolioPriceReturn = computePriceReturnTWR(valuations);

    // Both sides are now on the same (price-only) footing: neither
    // includes any dividend/distribution income.
    expect(portfolioPriceReturn[1].cumulativeReturnPct).toBeCloseTo(2, 6);
  });
});
