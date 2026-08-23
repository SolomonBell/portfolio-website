// Computes the PUBLIC holdings snapshot — ticker, name, allocation %,
// and a price-return performance history per holding. Never share
// counts, dollar values, or cash — the return type is exactly `Holding`
// from ../investing.ts, which structurally cannot carry those fields.

import type { Holding, HoldingPerformancePoint } from "../investing";
import { computeTWR } from "./twr";
import type { DailyValuation } from "./valuation";
import type { Transaction } from "./types";

/**
 * The most recent transition from zero (or absent) shares to a positive
 * share balance, walking the FULL valuation history in order. If a
 * position was fully sold and later reopened, this returns the
 * re-entry date, not the original purchase date — "current holding
 * period" means the position as it exists right now, not its entire
 * lifetime history. Returns `null` if the ticker isn't currently held.
 */
function currentPositionInception(
  ticker: string,
  valuations: DailyValuation[]
): string | null {
  let wasOpen = false;
  let inception: string | null = null;
  for (const v of valuations) {
    const isOpen = (v.positions[ticker] ?? 0) > 1e-9;
    if (isOpen && !wasOpen) inception = v.date;
    wasOpen = isOpen;
  }
  return wasOpen ? inception : null;
}

/** date -> net cash spent on BUYs minus proceeds from SELLs of `ticker`
 * on that date (0 on days with neither). */
function perTickerCashFlowByDate(
  ticker: string,
  transactions: Transaction[]
): Record<string, number> {
  const flow: Record<string, number> = {};
  for (const t of transactions) {
    if (!("ticker" in t) || t.ticker !== ticker) continue;
    if (t.type === "BUY") {
      flow[t.date] = (flow[t.date] ?? 0) + t.shares * t.price + (t.fee ?? 0);
    } else if (t.type === "SELL") {
      flow[t.date] = (flow[t.date] ?? 0) - (t.shares * t.price - (t.fee ?? 0));
    }
  }
  return flow;
}

/**
 * Price-return performance series for one ticker's CURRENT open
 * position, since its most recent zero -> positive transition.
 *
 * Methodology: this reuses the exact same daily-linked TWR formula as
 * the account-level engine (`computeTWR`), scoped to a single ticker —
 * BUY/SELL for that ticker are treated as external flows exactly the
 * way a deposit/withdrawal is treated for the whole account, so an
 * additional purchase (or a partial sale) never creates an artificial
 * jump in the series. This answers "how has this holding performed
 * while I owned it" rather than a naive `latest / first-purchase - 1`,
 * which would misrepresent performance once more than one purchase has
 * occurred.
 *
 * This is inherently a PRICE-return metric, consistent with the public
 * benchmark methodology: the per-ticker value fed in here is always
 * `shares * price` (via `DailyValuation.perTickerValue`) — dividend
 * cash is never attributed to a specific ticker's value in the first
 * place, so it never enters this series at all, without needing a
 * separate "exclude dividends" step.
 */
export function computeHoldingPerformance(
  ticker: string,
  transactions: Transaction[],
  valuations: DailyValuation[]
): HoldingPerformancePoint[] {
  const inception = currentPositionInception(ticker, valuations);
  if (!inception) return [];

  const cashFlowByDate = perTickerCashFlowByDate(ticker, transactions);

  // A lightweight synthetic DailyValuation stream scoped to this one
  // ticker's value — `computeTWR` only reads `.totalValue` and
  // `.externalFlow`, so the unused fields are structural placeholders.
  const syntheticValuations: DailyValuation[] = valuations
    .filter((v) => v.date >= inception)
    .map((v) => {
      const value = v.perTickerValue[ticker] ?? 0;
      return {
        date: v.date,
        cash: 0,
        positions: {},
        perTickerValue: {},
        marketValue: value,
        totalValue: value,
        externalFlow: cashFlowByDate[v.date] ?? 0,
        dividendFlow: 0,
      };
    });

  return computeTWR(syntheticValuations);
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
  valuations: DailyValuation[],
  tickerNames: Record<string, string> = {}
): Holding[] {
  if (valuations.length === 0) return [];

  const latest = valuations[valuations.length - 1];
  const holdings: Holding[] = [];

  for (const [ticker, shares] of Object.entries(latest.positions)) {
    if (shares <= 1e-9) continue;
    const value = latest.perTickerValue[ticker] ?? 0;

    holdings.push({
      ticker,
      name: tickerNames[ticker] ?? ticker,
      allocationPct: latest.marketValue > 0 ? (value / latest.marketValue) * 100 : 0,
      performance: computeHoldingPerformance(ticker, transactions, valuations),
    });
  }

  return holdings.sort((a, b) => b.allocationPct - a.allocationPct);
}
