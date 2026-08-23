// Computes the PUBLIC holdings snapshot — ticker, name, allocation %,
// and return % only. Never share counts, dollar values, or cash — the
// return type is exactly `Holding` from ../investing.ts, which
// structurally cannot carry those fields.
//
// This is always evaluated at the LATEST valuation date, so any split
// for a given ticker has, by definition, already fully occurred by
// then — the split-adjusted rescale factor is always 1 at "now" — so
// this can work directly with actual (raw) share counts and the
// latest price with no rescale math of its own.

import type { Holding } from "../investing";
import type { Transaction } from "./types";

/**
 * Return % here uses the same PRICE-RETURN convention as the public
 * chart for this phase (see ../portfolio/twr.ts): cost basis is the net
 * cash spent on BUYs minus proceeds from SELLs for that ticker, with no
 * dividend credit added back, so a holding's return % stays consistent
 * with the price-return performance chart rather than silently mixing
 * in a different (dividend-inclusive) methodology for this one number.
 */
function netInvestedByTicker(transactions: Transaction[]): Record<string, number> {
  const net: Record<string, number> = {};
  for (const t of transactions) {
    if (t.type === "BUY") {
      net[t.ticker] = (net[t.ticker] ?? 0) + t.shares * t.price + (t.fee ?? 0);
    } else if (t.type === "SELL") {
      net[t.ticker] = (net[t.ticker] ?? 0) - (t.shares * t.price - (t.fee ?? 0));
    }
  }
  return net;
}

/**
 * `tickerNames` is a caller-supplied ticker -> company-name map (there is
 * no such field in the APIStocks daily response, and this module will
 * not invent one). A ticker missing from the map falls back to
 * displaying the ticker itself rather than failing — an honest
 * placeholder, not fabricated data.
 */
export function computeHoldingsSnapshot(
  transactions: Transaction[],
  latestPositions: Record<string, number>,
  latestPrices: Record<string, number>,
  tickerNames: Record<string, string> = {}
): Holding[] {
  const netInvested = netInvestedByTicker(transactions);

  const rows: { ticker: string; value: number }[] = [];
  let totalValue = 0;

  for (const [ticker, shares] of Object.entries(latestPositions)) {
    if (shares <= 1e-9) continue;
    const price = latestPrices[ticker];
    if (price === undefined) {
      throw new Error(`No latest price available for held ticker ${ticker}`);
    }
    const value = shares * price;
    rows.push({ ticker, value });
    totalValue += value;
  }

  const holdings: Holding[] = rows.map(({ ticker, value }) => {
    const cost = netInvested[ticker];
    if (cost === undefined || cost === 0) {
      throw new Error(`No cost basis available for held ticker ${ticker}`);
    }
    return {
      ticker,
      name: tickerNames[ticker] ?? ticker,
      allocationPct: totalValue > 0 ? (value / totalValue) * 100 : 0,
      totalReturnPct: ((value - cost) / cost) * 100,
    };
  });

  return holdings.sort((a, b) => b.allocationPct - a.allocationPct);
}
