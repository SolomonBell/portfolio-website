import { describe, expect, it, vi } from "vitest";
import { buildPortfolioSnapshot, SnapshotBuildError } from "./build-portfolio-snapshot";
import type { DailyPricePoint, MarketDataProvider } from "./market-data/provider";
import type { Transaction } from "./portfolio";

function mockProvider(data: Record<string, DailyPricePoint[]>): MarketDataProvider {
  return {
    getDailyCloses: vi.fn(async (symbol: string) => {
      const series = data[symbol];
      if (!series) throw new Error(`no fixture data for ${symbol}`);
      return series;
    }),
  };
}

function series(prices: Record<string, number>): DailyPricePoint[] {
  return Object.entries(prices).map(([date, close]) => ({ date, close }));
}

describe("1 — empty ledger -> controlled not-started behavior", () => {
  it("returns a not-started result without invoking the provider", async () => {
    const provider = mockProvider({});
    const result = await buildPortfolioSnapshot({ transactions: [], provider });

    expect(result).toEqual({ status: "not-started" });
    expect(provider.getDailyCloses).not.toHaveBeenCalled();
  });
});

describe("2 — one funded portfolio", () => {
  const transactions: Transaction[] = [
    { id: "d1", date: "2026-08-18", type: "DEPOSIT", amount: 1000 },
    { id: "b1", date: "2026-08-18", type: "BUY", ticker: "AAPL", shares: 5, price: 200 },
  ];
  const provider = mockProvider({
    AAPL: series({ "2026-08-18": 200, "2026-08-19": 210, "2026-08-20": 220 }),
    SPY: series({ "2026-08-18": 450, "2026-08-19": 452, "2026-08-20": 454 }),
    QQQ: series({ "2026-08-18": 380, "2026-08-19": 382, "2026-08-20": 384 }),
  });

  it("builds a ready snapshot with correct portfolio return and one holding", async () => {
    const result = await buildPortfolioSnapshot({
      transactions,
      provider,
      dateEnd: "2026-08-20",
      tickerNames: { AAPL: "Apple Inc." },
    });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("expected ready");

    expect(result.snapshot.performance).toHaveLength(3);
    expect(result.snapshot.performance[0].portfolio).toBeCloseTo(0, 6);
    expect(result.snapshot.performance[2].portfolio).toBeCloseTo(10, 6); // 200 -> 220

    expect(result.snapshot.holdings).toHaveLength(1);
    expect(result.snapshot.holdings[0]).toMatchObject({
      ticker: "AAPL",
      name: "Apple Inc.",
      allocationPct: 100,
    });
    expect(result.snapshot.holdings[0].performance).toHaveLength(3);
    expect(result.snapshot.holdings[0].performance[0].cumulativeReturnPct).toBeCloseTo(0, 6);
    expect(result.snapshot.holdings[0].performance[2].cumulativeReturnPct).toBeCloseTo(10, 6);
  });
});

describe("3 — multiple holdings", () => {
  it("computes allocation percentages that sum to ~100 across holdings", async () => {
    const transactions: Transaction[] = [
      { id: "d1", date: "2026-08-18", type: "DEPOSIT", amount: 2000 },
      { id: "b1", date: "2026-08-18", type: "BUY", ticker: "AAPL", shares: 5, price: 200 },
      { id: "b2", date: "2026-08-18", type: "BUY", ticker: "MSFT", shares: 2, price: 500 },
    ];
    const provider = mockProvider({
      AAPL: series({ "2026-08-18": 200, "2026-08-19": 200 }),
      MSFT: series({ "2026-08-18": 500, "2026-08-19": 500 }),
      SPY: series({ "2026-08-18": 450, "2026-08-19": 450 }),
      QQQ: series({ "2026-08-18": 380, "2026-08-19": 380 }),
    });

    const result = await buildPortfolioSnapshot({
      transactions,
      provider,
      dateEnd: "2026-08-19",
    });
    if (result.status !== "ready") throw new Error("expected ready");

    expect(result.snapshot.holdings).toHaveLength(2);
    const totalAllocation = result.snapshot.holdings.reduce(
      (sum, h) => sum + h.allocationPct,
      0
    );
    expect(totalAllocation).toBeCloseTo(100, 6);
  });
});

describe("4 — benchmark assembly", () => {
  it("includes correctly rebased SPY and QQQ series alongside the portfolio", async () => {
    const transactions: Transaction[] = [
      { id: "d1", date: "2026-08-18", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-08-18", type: "BUY", ticker: "AAPL", shares: 5, price: 200 },
    ];
    const provider = mockProvider({
      AAPL: series({ "2026-08-18": 200, "2026-08-19": 200 }),
      SPY: series({ "2026-08-18": 450, "2026-08-19": 459 }), // +2%
      QQQ: series({ "2026-08-18": 380, "2026-08-19": 372.4 }), // -2%
    });

    const result = await buildPortfolioSnapshot({ transactions, provider, dateEnd: "2026-08-19" });
    if (result.status !== "ready") throw new Error("expected ready");

    expect(result.snapshot.performance[1].spy).toBeCloseTo(2, 6);
    expect(result.snapshot.performance[1].qqq).toBeCloseTo(-2, 6);
  });
});

describe("5 — latest-common-date trimming", () => {
  it("trims to the common floor rather than the longest series' range", async () => {
    const transactions: Transaction[] = [
      { id: "d1", date: "2026-08-18", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-08-18", type: "BUY", ticker: "AAPL", shares: 5, price: 200 },
    ];
    const provider = mockProvider({
      AAPL: series({ "2026-08-18": 200, "2026-08-19": 205 }), // stops at 08-19
      SPY: series({ "2026-08-18": 450, "2026-08-19": 452, "2026-08-20": 454 }),
      QQQ: series({ "2026-08-18": 380, "2026-08-19": 382, "2026-08-20": 384 }),
    });

    const result = await buildPortfolioSnapshot({ transactions, provider, dateEnd: "2026-08-20" });
    if (result.status !== "ready") throw new Error("expected ready");

    expect(result.snapshot.asOfDate).toBe("2026-08-19");
    expect(result.snapshot.performance).toHaveLength(2);
  });
});

describe("6 — missing holding price data (single-day gap)", () => {
  it("excludes the gapped date instead of throwing", async () => {
    const transactions: Transaction[] = [
      { id: "d1", date: "2026-08-18", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-08-18", type: "BUY", ticker: "AAPL", shares: 5, price: 200 },
    ];
    const provider = mockProvider({
      // AAPL is missing 08-19 entirely (a gap), present again on 08-20
      AAPL: series({ "2026-08-18": 200, "2026-08-20": 210 }),
      SPY: series({ "2026-08-18": 450, "2026-08-19": 451, "2026-08-20": 454 }),
      QQQ: series({ "2026-08-18": 380, "2026-08-19": 381, "2026-08-20": 384 }),
    });

    const result = await buildPortfolioSnapshot({ transactions, provider, dateEnd: "2026-08-20" });
    if (result.status !== "ready") throw new Error("expected ready");

    expect(result.snapshot.performance.map((p) => p.date)).toEqual([
      "2026-08-18",
      "2026-08-20",
    ]);
  });
});

describe("7 — missing benchmark price data (single-day gap)", () => {
  it("excludes a date QQQ is missing, even though the holding and SPY have it", async () => {
    const transactions: Transaction[] = [
      { id: "d1", date: "2026-08-18", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-08-18", type: "BUY", ticker: "AAPL", shares: 5, price: 200 },
    ];
    const provider = mockProvider({
      AAPL: series({ "2026-08-18": 200, "2026-08-19": 205, "2026-08-20": 210 }),
      SPY: series({ "2026-08-18": 450, "2026-08-19": 451, "2026-08-20": 454 }),
      QQQ: series({ "2026-08-18": 380, "2026-08-20": 384 }), // missing 08-19
    });

    const result = await buildPortfolioSnapshot({ transactions, provider, dateEnd: "2026-08-20" });
    if (result.status !== "ready") throw new Error("expected ready");

    expect(result.snapshot.performance.map((p) => p.date)).toEqual([
      "2026-08-18",
      "2026-08-20",
    ]);
  });
});

describe("8 — provider error propagation", () => {
  it("rejects rather than silently falling back when a required fetch fails", async () => {
    const transactions: Transaction[] = [
      { id: "d1", date: "2026-08-18", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-08-18", type: "BUY", ticker: "AAPL", shares: 5, price: 200 },
    ];
    const provider: MarketDataProvider = {
      getDailyCloses: vi.fn(async (symbol: string) => {
        if (symbol === "QQQ") throw new Error("APIStocks request failed: 503");
        return series({ "2026-08-18": 200, "2026-08-19": 200 });
      }),
    };

    await expect(
      buildPortfolioSnapshot({ transactions, provider, dateEnd: "2026-08-19" })
    ).rejects.toThrow(/503/);
  });
});

describe("9 — public snapshot contains no dollar/share/private values", () => {
  it("holdings objects contain exactly ticker, name, allocationPct, performance", async () => {
    const transactions: Transaction[] = [
      { id: "d1", date: "2026-08-18", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-08-18", type: "BUY", ticker: "AAPL", shares: 5, price: 200 },
    ];
    const provider = mockProvider({
      AAPL: series({ "2026-08-18": 200, "2026-08-19": 200 }),
      SPY: series({ "2026-08-18": 450, "2026-08-19": 450 }),
      QQQ: series({ "2026-08-18": 380, "2026-08-19": 380 }),
    });

    const result = await buildPortfolioSnapshot({ transactions, provider, dateEnd: "2026-08-19" });
    if (result.status !== "ready") throw new Error("expected ready");

    for (const holding of result.snapshot.holdings) {
      expect(Object.keys(holding).sort()).toEqual(
        ["allocationPct", "name", "performance", "ticker"].sort()
      );
      for (const point of holding.performance) {
        expect(Object.keys(point).sort()).toEqual(["cumulativeReturnPct", "date"].sort());
      }
    }
    for (const point of result.snapshot.performance) {
      expect(Object.keys(point).sort()).toEqual(["date", "portfolio", "qqq", "spy"].sort());
    }
  });
});

describe("10 — correct asOfDate", () => {
  it("matches the latest common trading date, not today's calendar date", async () => {
    const transactions: Transaction[] = [
      { id: "d1", date: "2026-08-18", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-08-18", type: "BUY", ticker: "AAPL", shares: 5, price: 200 },
    ];
    const provider = mockProvider({
      AAPL: series({ "2026-08-18": 200, "2026-08-19": 205 }),
      SPY: series({ "2026-08-18": 450, "2026-08-19": 452 }),
      QQQ: series({ "2026-08-18": 380, "2026-08-19": 382 }),
    });

    const result = await buildPortfolioSnapshot({
      transactions,
      provider,
      dateEnd: "2026-08-19",
    });
    if (result.status !== "ready") throw new Error("expected ready");
    expect(result.snapshot.asOfDate).toBe("2026-08-19");
  });

  it("throws SnapshotBuildError when there is no common date at all", async () => {
    const transactions: Transaction[] = [
      { id: "d1", date: "2026-08-18", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-08-18", type: "BUY", ticker: "AAPL", shares: 5, price: 200 },
    ];
    const provider = mockProvider({
      AAPL: series({ "2026-08-18": 200 }),
      SPY: series({ "2026-08-19": 450 }), // no overlapping date
      QQQ: series({ "2026-08-19": 380 }),
    });

    await expect(
      buildPortfolioSnapshot({ transactions, provider, dateEnd: "2026-08-19" })
    ).rejects.toThrow(SnapshotBuildError);
  });
});

describe("11 — real-series shape matches existing PortfolioSnapshot", () => {
  it("returns the exact PortfolioSnapshot shape (asOfDate, performance, intraday, holdings)", async () => {
    const transactions: Transaction[] = [
      { id: "d1", date: "2026-08-18", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-08-18", type: "BUY", ticker: "AAPL", shares: 5, price: 200 },
    ];
    const provider = mockProvider({
      AAPL: series({ "2026-08-18": 200, "2026-08-19": 200 }),
      SPY: series({ "2026-08-18": 450, "2026-08-19": 450 }),
      QQQ: series({ "2026-08-18": 380, "2026-08-19": 380 }),
    });

    const result = await buildPortfolioSnapshot({ transactions, provider, dateEnd: "2026-08-19" });
    if (result.status !== "ready") throw new Error("expected ready");

    expect(typeof result.snapshot.asOfDate).toBe("string");
    expect(Array.isArray(result.snapshot.performance)).toBe(true);
    expect(Array.isArray(result.snapshot.intraday)).toBe(true);
    expect(Array.isArray(result.snapshot.holdings)).toBe(true);
    for (const p of result.snapshot.performance) {
      expect(typeof p.date).toBe("string");
      expect(typeof p.portfolio).toBe("number");
      expect(typeof p.spy).toBe("number");
      expect(typeof p.qqq).toBe("number");
    }
  });
});

describe("12 — split-adjusted valuation path is used", () => {
  it("stays economically continuous through a split, proving split-adjusted mode is active", async () => {
    const transactions: Transaction[] = [
      { id: "d1", date: "2026-08-18", type: "DEPOSIT", amount: 5000 },
      { id: "b1", date: "2026-08-18", type: "BUY", ticker: "AAPL", shares: 10, price: 500 },
      { id: "sp1", date: "2026-08-20", type: "SPLIT", ticker: "AAPL", ratio: [4, 1] },
    ];
    // Split-adjusted-style fixture: pre-split prices already divided by 4.
    const provider = mockProvider({
      AAPL: series({ "2026-08-18": 125, "2026-08-19": 125, "2026-08-20": 125 }),
      SPY: series({ "2026-08-18": 450, "2026-08-19": 450, "2026-08-20": 450 }),
      QQQ: series({ "2026-08-18": 380, "2026-08-19": 380, "2026-08-20": 380 }),
    });

    const result = await buildPortfolioSnapshot({ transactions, provider, dateEnd: "2026-08-20" });
    if (result.status !== "ready") throw new Error("expected ready");

    // Flat adjusted prices the whole way through (no real price move) and
    // a split in the middle: if split-adjusted mode were NOT active, the
    // raw pre-split share count (10) against these already-divided
    // prices would show as if the position had lost 75% of its value
    // before the split. Instead, it must read exactly 0% throughout.
    for (const point of result.snapshot.performance) {
      expect(point.portfolio).toBeCloseTo(0, 6);
    }
  });
});
