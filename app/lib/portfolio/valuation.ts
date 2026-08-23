// Builds a daily valuation series from a transaction ledger + price
// history: V_t = cash_t + sum(shares_i,t * price_i,t).
//
// This is the layer that turns "what happened" (the ledger) into "what
// was the account worth on each day" — the input the TWR engine needs.

import {
  applyTransaction,
  getInceptionDate,
  initialLedgerState,
  validateAndSortLedger,
} from "./ledger";
import type { PriceHistory, Transaction } from "./types";

export class ValuationError extends Error {}

export type DailyValuation = {
  date: string;
  cash: number;
  /** ticker -> ACTUAL shares held as of the end of this date (the real,
   * immutable-ledger truth — never rescaled for the split-adjusted price
   * convention below). */
  positions: Record<string, number>;
  /** sum(shares_i * price_i) for all open positions, in whichever price
   * convention was requested (see `PriceConvention`). */
  marketValue: number;
  /** ticker -> that position's own dollar value on this date, in the
   * same price convention as `marketValue` (i.e. already split-rescaled
   * where applicable — `marketValue` is the sum of these). Exposed so a
   * per-holding return series can be derived without recomputing the
   * split-rescale math itself (see portfolio/holdings.ts). */
  perTickerValue: Record<string, number>;
  /** cash + marketValue */
  totalValue: number;
  /** net deposits minus withdrawals that occurred on this date (0 most days) */
  externalFlow: number;
  /** dividend cash received on this date (0 most days). Tracked
   * separately from `externalFlow` — dividends are investment return,
   * not an external flow, for the account's true TWR (see twr.ts). They
   * are exposed here so a *different* return metric — the public
   * price-return comparison — can choose to exclude them instead. */
  dividendFlow: number;
};

/**
 * Which convention the supplied `priceHistory` uses, and therefore how
 * a ledger SPLIT transaction should be reconciled against it:
 *
 * - "raw" (default): prices are exactly as the security actually traded
 *   — a $500 pre-split AAPL close stays $500 in the data. A ledger
 *   SPLIT transaction is the sole, correct source of the share-count
 *   change, applied prospectively at its date (unchanged since the
 *   engine's original design).
 *
 * - "split-adjusted": prices have already been retroactively adjusted
 *   by the data provider so historical prices are expressed in
 *   *current* share-count terms (APIStocks' daily history behaves this
 *   way — a manual AAPL test showed pre-2020-split prices already
 *   divided by 4). Applying the ledger's SPLIT transaction on top of
 *   that would double-count the split: shares would jump at the split
 *   date *and* the price series already reflects the post-split scale
 *   for dates before it, understating pre-split value by the split
 *   ratio and then producing a fabricated jump in the performance chart
 *   exactly at the split date.
 *
 *   In this mode, the ledger is NOT rewritten (the SPLIT transaction and
 *   every BUY/SELL keep their real, historical share counts/prices).
 *   Instead, purely for `marketValue`, share counts are *retroactively
 *   rescaled* to the same "current terms" the price series already
 *   uses: effectiveShares_t = actualShares_t * (totalSplitFactor /
 *   appliedSplitFactor_t), where totalSplitFactor is the product of all
 *   of that ticker's SPLIT ratios in the ledger, and appliedSplitFactor_t
 *   is the product of only the ones that have occurred by date t. Before
 *   any split, appliedSplitFactor_t is 1, so shares are scaled up to
 *   post-split terms to match the (already-adjusted) historical price —
 *   after the last split, the ratio is 1 and this is a no-op, so the two
 *   conventions agree from that point forward.
 */
export type PriceConvention = "raw" | "split-adjusted";

function priceOn(priceHistory: PriceHistory, ticker: string, date: string): number {
  const series = priceHistory[ticker];
  const point = series?.find((p) => p.date === date);
  if (!point) {
    throw new ValuationError(`No price for ${ticker} on ${date}`);
  }
  return point.price;
}

/**
 * Builds one valuation record per trading date, starting no earlier than
 * portfolio inception (the first DEPOSIT date) — dates before inception
 * are dropped even if present in `tradingDates`, since the engine must
 * never generate portfolio performance before the account existed.
 *
 * `tradingDates` must be sorted ascending and should include the
 * inception date itself.
 */
export function buildDailyValuations(
  transactions: Transaction[],
  priceHistory: PriceHistory,
  tradingDates: string[],
  priceConvention: PriceConvention = "raw"
): DailyValuation[] {
  const sorted = validateAndSortLedger(transactions);
  if (sorted.length === 0) return [];

  const inception = getInceptionDate(sorted);
  const activeDates = tradingDates.filter((d) => d >= inception);
  if (activeDates.length === 0) {
    throw new ValuationError(
      `No trading dates on or after portfolio inception (${inception})`
    );
  }

  const activeDateSet = new Set(activeDates);
  const byDate = new Map<string, Transaction[]>();
  for (const t of sorted) {
    if (t.date < inception) continue;
    if (!activeDateSet.has(t.date)) {
      throw new ValuationError(
        `Transaction ${t.id} is dated ${t.date}, which is not in the supplied trading calendar`
      );
    }
    const bucket = byDate.get(t.date);
    if (bucket) bucket.push(t);
    else byDate.set(t.date, [t]);
  }

  // Total lifetime split factor per ticker, needed only in
  // "split-adjusted" mode to compute the retroactive rescale described
  // above. Computed once upfront from the full (validated) ledger.
  const totalSplitFactor: Record<string, number> = {};
  if (priceConvention === "split-adjusted") {
    for (const t of sorted) {
      if (t.type === "SPLIT") {
        const [n, d] = t.ratio;
        totalSplitFactor[t.ticker] = (totalSplitFactor[t.ticker] ?? 1) * (n / d);
      }
    }
  }

  let state = initialLedgerState();
  // How much of each ticker's totalSplitFactor has been "unlocked" by
  // the current date, tracked in parallel with (but independent of)
  // `state.shares` — see the PriceConvention doc comment above.
  const appliedSplitFactor: Record<string, number> = {};
  const valuations: DailyValuation[] = [];

  for (const date of activeDates) {
    let externalFlow = 0;
    let dividendFlow = 0;
    for (const t of byDate.get(date) ?? []) {
      if (t.type === "DEPOSIT") externalFlow += t.amount;
      if (t.type === "WITHDRAWAL") externalFlow -= t.amount;
      if (t.type === "DIVIDEND") dividendFlow += t.amount;
      if (priceConvention === "split-adjusted" && t.type === "SPLIT") {
        const [n, d] = t.ratio;
        appliedSplitFactor[t.ticker] = (appliedSplitFactor[t.ticker] ?? 1) * (n / d);
      }
      state = applyTransaction(state, t);
    }

    let marketValue = 0;
    const positions: Record<string, number> = {};
    const perTickerValue: Record<string, number> = {};
    for (const [ticker, shares] of Object.entries(state.shares)) {
      if (shares <= 1e-9) continue;
      positions[ticker] = shares;

      const price = priceOn(priceHistory, ticker, date);
      let value: number;
      if (priceConvention === "split-adjusted") {
        const total = totalSplitFactor[ticker] ?? 1;
        const applied = appliedSplitFactor[ticker] ?? 1;
        value = shares * (total / applied) * price;
      } else {
        value = shares * price;
      }
      perTickerValue[ticker] = value;
      marketValue += value;
    }

    valuations.push({
      date,
      cash: state.cash,
      positions,
      marketValue,
      perTickerValue,
      totalValue: state.cash + marketValue,
      externalFlow,
      dividendFlow,
    });
  }

  return valuations;
}
