// Daily-linked time-weighted return, plus a second variant for public
// benchmark comparison.
//
// Two distinct, deliberately separate metrics live in this file:
//
// 1. `computeTWR` — the account's TRUE time-weighted return. Dividends
//    count as investment return (they are NOT in CF_t). This is the
//    economically correct number for the account itself and should
//    remain the one used for any private/internal accounting.
//
// 2. `computePriceReturnTWR` — the PUBLIC comparison metric used
//    alongside the S&P 500 / NASDAQ-100 benchmark series. Our benchmark
//    data is ETF `Close` price only (see app/lib/market-data/apistocks.ts
//    — APIStocks' AdjClose has not been verified to include dividend
//    adjustment, so it is not used as a total-return series). A
//    dividend-inclusive portfolio number compared against a
//    dividend-EXCLUDED benchmark would be an unfair, apples-to-oranges
//    comparison — the portfolio would look better purely because it
//    counts income the benchmark side can't. `computePriceReturnTWR`
//    fixes this by treating dividends the same way a deposit is
//    treated for THIS metric only: excluded from the return numerator,
//    exactly mirroring how a Close-price series has no way to reflect
//    dividend income either. The dividend cash is still real, still
//    sitting in the account's cash balance (V_t is untouched) — only
//    this specific *return* calculation discounts it.
//
// Both share the same underlying formula:
//
//   CF_t   = <the flows this metric excludes> on day t
//   r_t    = (V_t - CF_t) / V_(t-1) - 1
//   TWR_t  = product(1 + r_i) - 1
//
// When real total-return benchmark data becomes available later, the
// switch is: use `computeTWR` (dividends already included) instead of
// `computePriceReturnTWR` for the public chart, and feed
// `computeBenchmarkReturn` a total-return series instead of a
// price-only one — no changes to this formula or to valuation.ts.

import type { DailyValuation } from "./valuation";

export type TWRPoint = {
  date: string;
  /** Cumulative time-weighted return since inception, as a percentage. */
  cumulativeReturnPct: number;
};

function computeTWRFromFlows(
  valuations: DailyValuation[],
  excludedFlow: (v: DailyValuation) => number
): TWRPoint[] {
  if (valuations.length === 0) return [];

  const points: TWRPoint[] = [{ date: valuations[0].date, cumulativeReturnPct: 0 }];

  let growth = 1;
  let prevValue = valuations[0].totalValue;

  for (let i = 1; i < valuations.length; i++) {
    const v = valuations[i];
    const dailyReturn =
      prevValue > 0 ? (v.totalValue - excludedFlow(v)) / prevValue - 1 : 0;
    growth *= 1 + dailyReturn;
    points.push({ date: v.date, cumulativeReturnPct: (growth - 1) * 100 });
    prevValue = v.totalValue;
  }

  return points;
}

/**
 * The account's true time-weighted return. Only DEPOSIT/WITHDRAWAL are
 * excluded from return — dividends count as investment gain. The first
 * valuation record is portfolio inception by definition and is always
 * 0.00%: there is no prior value to compute a return against, so this
 * is an intentional base case, not an approximation.
 */
export function computeTWR(valuations: DailyValuation[]): TWRPoint[] {
  return computeTWRFromFlows(valuations, (v) => v.externalFlow);
}

/**
 * The public price-return comparison metric: DEPOSIT/WITHDRAWAL *and*
 * DIVIDEND are excluded from return, so the number stays apples-to-apples
 * with a dividend-excluded (Close-price-only) benchmark series. This is
 * NOT the account's true performance — see the file header.
 */
export function computePriceReturnTWR(valuations: DailyValuation[]): TWRPoint[] {
  return computeTWRFromFlows(valuations, (v) => v.externalFlow + v.dividendFlow);
}
