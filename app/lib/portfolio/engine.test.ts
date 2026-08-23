import { describe, expect, it } from "vitest";
import { buildDailyValuations } from "./valuation";
import { computeTWR } from "./twr";
import type { PriceHistory, Transaction } from "./types";

function run(transactions: Transaction[], prices: PriceHistory, tradingDates: string[]) {
  const valuations = buildDailyValuations(transactions, prices, tradingDates);
  const twr = computeTWR(valuations);
  return { valuations, twr };
}

describe("A — initial deposit", () => {
  it("establishes inception at $1,000 / 0% TWR", () => {
    const { valuations, twr } = run(
      [{ id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 }],
      {},
      ["2026-01-01"]
    );
    expect(valuations[0].cash).toBe(1000);
    expect(valuations[0].totalValue).toBe(1000);
    expect(twr[0].cumulativeReturnPct).toBe(0);
  });
});

describe("B — buying a stock creates no return", () => {
  it("cash -> securities, value and TWR unchanged", () => {
    const { valuations, twr } = run(
      [
        { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
        { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 10, price: 100 },
      ],
      { XYZ: [{ date: "2026-01-01", price: 100 }] },
      ["2026-01-01"]
    );
    expect(valuations[0].cash).toBe(0);
    expect(valuations[0].marketValue).toBe(1000);
    expect(valuations[0].totalValue).toBe(1000);
    expect(twr[0].cumulativeReturnPct).toBe(0);
  });
});

describe("C — price appreciation", () => {
  it("reflects a real 10% gain in TWR", () => {
    const { valuations, twr } = run(
      [
        { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
        { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 10, price: 100 },
      ],
      { XYZ: [{ date: "2026-01-01", price: 100 }, { date: "2026-01-02", price: 110 }] },
      ["2026-01-01", "2026-01-02"]
    );
    expect(valuations[1].totalValue).toBe(1100);
    expect(twr[1].cumulativeReturnPct).toBeCloseTo(10, 6);
  });
});

describe("D — additional deposit does not create performance", () => {
  it("value jumps, TWR does not", () => {
    const { valuations, twr } = run(
      [
        { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
        { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 10, price: 100 },
        { id: "d2", date: "2026-01-03", type: "DEPOSIT", amount: 1000 },
      ],
      {
        XYZ: [
          { date: "2026-01-01", price: 100 },
          { date: "2026-01-02", price: 110 },
          { date: "2026-01-03", price: 110 },
        ],
      },
      ["2026-01-01", "2026-01-02", "2026-01-03"]
    );
    expect(valuations[2].totalValue).toBe(2100);
    expect(twr[2].cumulativeReturnPct).toBeCloseTo(10, 6); // unchanged from day 2
  });
});

describe("E — withdrawal does not create a loss", () => {
  it("value falls, TWR does not", () => {
    const { valuations, twr } = run(
      [
        { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
        { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 10, price: 100 },
        { id: "d2", date: "2026-01-03", type: "DEPOSIT", amount: 1000 },
        { id: "w1", date: "2026-01-04", type: "WITHDRAWAL", amount: 500 },
      ],
      {
        XYZ: [
          { date: "2026-01-01", price: 100 },
          { date: "2026-01-02", price: 110 },
          { date: "2026-01-03", price: 110 },
          { date: "2026-01-04", price: 110 },
        ],
      },
      ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"]
    );
    expect(valuations[3].totalValue).toBe(1600);
    expect(twr[3].cumulativeReturnPct).toBeCloseTo(10, 6); // unchanged
  });
});

describe("F — buy after a later deposit", () => {
  it("neither the deposit nor the BUY produces artificial return", () => {
    const { valuations, twr } = run(
      [
        { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
        { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 10, price: 100 },
        { id: "d2", date: "2026-01-03", type: "DEPOSIT", amount: 500 },
        { id: "b2", date: "2026-01-03", type: "BUY", ticker: "ABC", shares: 5, price: 100 },
      ],
      {
        XYZ: [
          { date: "2026-01-01", price: 100 },
          { date: "2026-01-02", price: 110 },
          { date: "2026-01-03", price: 110 },
        ],
        ABC: [{ date: "2026-01-03", price: 100 }],
      },
      ["2026-01-01", "2026-01-02", "2026-01-03"]
    );
    expect(valuations[2].totalValue).toBe(1600);
    expect(twr[2].cumulativeReturnPct).toBeCloseTo(10, 6); // unchanged from day 2
  });
});

describe("G — partial sale", () => {
  it("moves value from security to cash with no artificial return", () => {
    const { valuations, twr } = run(
      [
        { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
        { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 10, price: 100 },
        { id: "s1", date: "2026-01-03", type: "SELL", ticker: "XYZ", shares: 4, price: 110 },
      ],
      {
        XYZ: [
          { date: "2026-01-01", price: 100 },
          { date: "2026-01-02", price: 110 },
          { date: "2026-01-03", price: 110 },
        ],
      },
      ["2026-01-01", "2026-01-02", "2026-01-03"]
    );
    expect(valuations[2].cash).toBe(440);
    expect(valuations[2].marketValue).toBe(660);
    expect(valuations[2].totalValue).toBe(1100);
    expect(twr[2].cumulativeReturnPct).toBeCloseTo(10, 6); // unchanged
  });
});

describe("H — full sale", () => {
  it("liquidates to cash, remains economically continuous", () => {
    const { valuations, twr } = run(
      [
        { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
        { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 10, price: 100 },
        { id: "s1", date: "2026-01-03", type: "SELL", ticker: "XYZ", shares: 10, price: 110 },
      ],
      {
        XYZ: [
          { date: "2026-01-01", price: 100 },
          { date: "2026-01-02", price: 110 },
          { date: "2026-01-03", price: 110 },
        ],
      },
      ["2026-01-01", "2026-01-02", "2026-01-03"]
    );
    expect(valuations[2].positions.XYZ).toBeUndefined();
    expect(valuations[2].marketValue).toBe(0);
    expect(valuations[2].cash).toBe(1100);
    expect(valuations[2].totalValue).toBe(1100);
    expect(twr[2].cumulativeReturnPct).toBeCloseTo(10, 6); // unchanged
  });
});

describe("I — dividend", () => {
  it("is counted as positive investment return, not an external flow", () => {
    const { valuations, twr } = run(
      [
        { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
        { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 10, price: 100 },
        { id: "div1", date: "2026-01-02", type: "DIVIDEND", ticker: "XYZ", amount: 20 },
      ],
      { XYZ: [{ date: "2026-01-01", price: 100 }, { date: "2026-01-02", price: 100 }] },
      ["2026-01-01", "2026-01-02"]
    );
    expect(valuations[1].cash).toBe(20);
    expect(valuations[1].totalValue).toBe(1020);
    expect(twr[1].cumulativeReturnPct).toBeCloseTo(2, 6);
  });
});

describe("J — trade fee", () => {
  it("reduces return and is not neutralized as an external flow", () => {
    const { valuations, twr } = run(
      [
        { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
        { id: "b1", date: "2026-01-02", type: "BUY", ticker: "XYZ", shares: 10, price: 99, fee: 10 },
      ],
      { XYZ: [{ date: "2026-01-02", price: 99 }] },
      ["2026-01-01", "2026-01-02"]
    );
    expect(valuations[1].cash).toBe(0);
    expect(valuations[1].totalValue).toBe(990);
    expect(twr[1].cumulativeReturnPct).toBeCloseTo(-1, 6);
  });
});

describe("K — stock split", () => {
  it("forward 2-for-1: doubles shares, produces no gain/loss, ledger stays immutable", () => {
    const buy: Transaction = {
      id: "b1",
      date: "2026-01-01",
      type: "BUY",
      ticker: "XYZ",
      shares: 10,
      price: 100,
    };
    const transactions: Transaction[] = [
      { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
      buy,
      { id: "sp1", date: "2026-01-03", type: "SPLIT", ticker: "XYZ", ratio: [2, 1] },
    ];
    const { valuations, twr } = run(
      transactions,
      {
        XYZ: [
          { date: "2026-01-01", price: 100 },
          { date: "2026-01-02", price: 104 },
          { date: "2026-01-03", price: 52 },
        ],
      },
      ["2026-01-01", "2026-01-02", "2026-01-03"]
    );

    // historical record unchanged
    expect(buy.shares).toBe(10);
    expect(buy.price).toBe(100);

    // position prospectively adjusted
    expect(valuations[2].positions.XYZ).toBe(20);
    expect(valuations[2].totalValue).toBe(1040);
    expect(twr[1].cumulativeReturnPct).toBeCloseTo(4, 6); // pre-split gain
    expect(twr[2].cumulativeReturnPct).toBeCloseTo(4, 6); // unchanged by the split itself
  });

  it("reverse 1-for-2: halves shares, produces no gain/loss", () => {
    const { valuations, twr } = run(
      [
        { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
        { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 10, price: 100 },
        { id: "sp1", date: "2026-01-02", type: "SPLIT", ticker: "XYZ", ratio: [1, 2] },
      ],
      { XYZ: [{ date: "2026-01-01", price: 100 }, { date: "2026-01-02", price: 200 }] },
      ["2026-01-01", "2026-01-02"]
    );
    expect(valuations[1].positions.XYZ).toBe(5);
    expect(valuations[1].totalValue).toBe(1000);
    expect(twr[1].cumulativeReturnPct).toBeCloseTo(0, 6);
  });
});

describe("11 — split-adjusted price convention (APIStocks-style split-normalized history)", () => {
  it("stays economically continuous through a split when prices are already split-adjusted", () => {
    // Mirrors the manually verified APIStocks behavior: pre-split
    // historical Close is already expressed in post-split terms (an
    // AAPL 4-for-1 split test showed ~$125 pre-split, not ~$500).
    const buy: Transaction = {
      id: "b1",
      date: "2026-01-01",
      type: "BUY",
      ticker: "XYZ",
      shares: 10,
      price: 500, // real, historical, immutable execution price
    };
    const transactions: Transaction[] = [
      { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 5000 },
      buy,
      { id: "sp1", date: "2026-01-03", type: "SPLIT", ticker: "XYZ", ratio: [4, 1] },
    ];

    // Split-adjusted price history: PRE-split dates are ALREADY divided
    // by 4 (as APIStocks returns them), not the raw ~$500 the security
    // actually traded at. POST-split dates need no further adjustment —
    // they're already expressed in "current" (post-split) terms, which
    // is what "split-adjusted" means. Day 3 is flat vs. day 2 (no real
    // price movement) so the split's effect is isolated cleanly.
    const priceHistory: PriceHistory = {
      XYZ: [
        { date: "2026-01-01", price: 125 }, // 500 / 4, already adjusted
        { date: "2026-01-02", price: 130 }, // real +4% move, adjusted terms
        { date: "2026-01-03", price: 130 }, // no further move; already post-split scale
      ],
    };

    const valuations = buildDailyValuations(
      transactions,
      priceHistory,
      ["2026-01-01", "2026-01-02", "2026-01-03"],
      "split-adjusted"
    );
    const twr = computeTWR(valuations);

    // Ledger stays immutable regardless of price convention.
    expect(buy.shares).toBe(10);
    expect(buy.price).toBe(500);

    // Day 1 (inception): 10 actual shares, not yet rescaled (no split
    // applied yet), against the already-adjusted $125 price would
    // naively read as $1,250 — but the retroactive rescale corrects
    // this to the true $5,000 (10 real shares * $500 real price).
    expect(valuations[0].positions.XYZ).toBe(10); // real/actual shares
    expect(valuations[0].marketValue).toBeCloseTo(5000, 6);
    expect(twr[0].cumulativeReturnPct).toBeCloseTo(0, 6);

    // Day 2: real 4% price move (130 adjusted vs 125 adjusted — the
    // same 4% the raw pre-split prices would have shown), correctly
    // reflected with no split-related distortion.
    expect(valuations[1].marketValue).toBeCloseTo(5200, 6);
    expect(twr[1].cumulativeReturnPct).toBeCloseTo(4, 6);

    // Day 3: the split itself fires (real ledger shares become 40).
    // Value must stay continuous — no fabricated jump from either the
    // ledger's share multiplication or the price series' pre-baked
    // adjustment.
    expect(valuations[2].positions.XYZ).toBe(40); // real post-split shares
    expect(valuations[2].marketValue).toBeCloseTo(5200, 6); // unchanged from day 2
    expect(twr[2].cumulativeReturnPct).toBeCloseTo(4, 6); // unchanged by the split
  });

  it("agrees with the raw-price convention once entirely past the split", () => {
    // After all of a ticker's splits have occurred, split-adjusted and
    // raw prices are numerically identical, and so is the outcome.
    const rawResult = buildDailyValuations(
      [
        { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
        { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 10, price: 100 },
        { id: "sp1", date: "2026-01-02", type: "SPLIT", ticker: "XYZ", ratio: [2, 1] },
      ],
      {
        XYZ: [
          { date: "2026-01-01", price: 100 },
          { date: "2026-01-02", price: 50 },
          { date: "2026-01-03", price: 55 },
        ],
      },
      ["2026-01-01", "2026-01-02", "2026-01-03"],
      "raw"
    );
    const adjustedResult = buildDailyValuations(
      [
        { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
        { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 10, price: 100 },
        { id: "sp1", date: "2026-01-02", type: "SPLIT", ticker: "XYZ", ratio: [2, 1] },
      ],
      {
        XYZ: [
          { date: "2026-01-01", price: 50 }, // pre-adjusted, differs from raw
          { date: "2026-01-02", price: 50 },
          { date: "2026-01-03", price: 55 },
        ],
      },
      ["2026-01-01", "2026-01-02", "2026-01-03"],
      "split-adjusted"
    );

    // Both price histories describe the same real economic value at
    // every date (the adjusted series is just the raw series divided by
    // the split ratio for pre-split dates) — so both conventions must
    // agree throughout, and in particular after the split date, where
    // the rescale factor becomes a no-op (applied === total).
    expect(rawResult[2].totalValue).toBeCloseTo(adjustedResult[2].totalValue, 6);
    expect(rawResult[0].totalValue).toBeCloseTo(adjustedResult[0].totalValue, 6);
  });
});

describe("L — idle cash", () => {
  it("acts as a zero-return component of the managed portfolio", () => {
    const { valuations, twr } = run(
      [
        { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
        { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 5, price: 100 },
      ],
      { XYZ: [{ date: "2026-01-01", price: 100 }, { date: "2026-01-02", price: 110 }] },
      ["2026-01-01", "2026-01-02"]
    );
    expect(valuations[1].marketValue).toBe(550);
    expect(valuations[1].cash).toBe(500);
    expect(valuations[1].totalValue).toBe(1050);
    expect(twr[1].cumulativeReturnPct).toBeCloseTo(5, 6);
  });
});
