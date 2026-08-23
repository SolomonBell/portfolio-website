// Orchestrates the full real-data pipeline:
//
//   APIStocks -> normalized market data -> transaction ledger
//   -> daily valuations (split-adjusted) -> public price-return TWR
//   -> SPY/QQQ benchmark price return -> latest common date
//   -> PortfolioSnapshot (existing frontend contract)
//
// This module is NOT wired into the public site yet — nothing here is
// imported by app/sections/Investing.tsx. See the phase report for
// exactly what remains to make that switch once the ledger is funded.

import { transactions as realTransactions } from "../../data/transactions";
import { ApiStocksProvider } from "./market-data/apistocks";
import { BENCHMARKS } from "./market-data/config";
import { commonDates } from "./market-data/dates";
import type { MarketDataProvider } from "./market-data/provider";
import type { PerformancePoint, PortfolioSnapshot } from "./investing";
import {
  assemblePerformancePoints,
  buildDailyValuations,
  computeBenchmarkReturn,
  computeHoldingsSnapshot,
  computePriceReturnTWR,
  validateAndSortLedger,
  type PriceHistory,
  type Transaction,
} from "./portfolio";

export class SnapshotBuildError extends Error {}

export type BuildSnapshotResult =
  | { status: "not-started" }
  | { status: "ready"; snapshot: PortfolioSnapshot };

export type BuildSnapshotOptions = {
  /** Injectable for tests; defaults to a real ApiStocksProvider. */
  provider?: MarketDataProvider;
  /** Injectable for tests; defaults to the real data/transactions.ts ledger. */
  transactions?: Transaction[];
  /** Defaults to portfolio inception (the first DEPOSIT date). */
  dateStart?: string;
  /** Defaults to today (UTC, "YYYY-MM-DD"). */
  dateEnd?: string;
  /** ticker -> display company name. APIStocks' daily response has no
   * name field, so this is not derived automatically — supply it once
   * real holdings exist. Missing entries fall back to the ticker itself. */
  tickerNames?: Record<string, string>;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function hasTicker(t: Transaction): t is Extract<Transaction, { ticker: string }> {
  return "ticker" in t;
}

/**
 * Builds the real `PortfolioSnapshot`, or reports that the portfolio
 * hasn't started yet.
 *
 * Design note on the return type: "no DEPOSIT yet" is an expected,
 * ordinary, long-lived state for this site (not an exceptional
 * condition), so it's represented as a typed result rather than a
 * thrown error — that keeps it cleanly distinguishable from genuine
 * failures (a bad provider response, a missing price, an invalid
 * ledger), which DO throw and propagate rather than being silently
 * absorbed into the same code path as "not started yet." Never invents
 * a deposit, holdings, or performance data for the not-started case.
 */
export async function buildPortfolioSnapshot(
  options: BuildSnapshotOptions = {}
): Promise<BuildSnapshotResult> {
  const provider = options.provider ?? new ApiStocksProvider();
  const transactions = options.transactions ?? realTransactions;

  const sorted = validateAndSortLedger(transactions);
  const firstDeposit = sorted.find((t) => t.type === "DEPOSIT");
  if (!firstDeposit) {
    return { status: "not-started" };
  }
  const inception = firstDeposit.date;

  const dateStart = options.dateStart ?? inception;
  const dateEnd = options.dateEnd ?? todayISO();

  const tickers = [...new Set(sorted.filter(hasTicker).map((t) => t.ticker))];

  const [holdingFetches, spyPrices, qqqPrices] = await Promise.all([
    Promise.all(
      tickers.map(async (ticker) => ({
        ticker,
        prices: await provider.getDailyCloses(ticker, dateStart, dateEnd),
      }))
    ),
    provider.getDailyCloses(BENCHMARKS.sp500.symbol, dateStart, dateEnd),
    provider.getDailyCloses(BENCHMARKS.nasdaq100.symbol, dateStart, dateEnd),
  ]);

  // Trading calendar = dates every required series actually has data
  // for. A gap in any single symbol's feed is excluded, never papered
  // over with a fabricated/interpolated price.
  const activeDates = commonDates([
    spyPrices,
    qqqPrices,
    ...holdingFetches.map((h) => h.prices),
  ]).filter((d) => d >= inception);

  if (activeDates.length === 0) {
    throw new SnapshotBuildError(
      "No common trading date found across portfolio holdings and both benchmarks on or after inception"
    );
  }

  const asOfDate = activeDates[activeDates.length - 1];
  const activeDateSet = new Set(activeDates);

  const priceHistory: PriceHistory = {};
  for (const { ticker, prices } of holdingFetches) {
    priceHistory[ticker] = prices.map((p) => ({ date: p.date, price: p.close }));
  }

  const valuations = buildDailyValuations(
    transactions,
    priceHistory,
    activeDates,
    "split-adjusted"
  );
  const portfolioReturn = computePriceReturnTWR(valuations);

  const spyReturn = computeBenchmarkReturn(
    spyPrices
      .filter((p) => activeDateSet.has(p.date))
      .map((p) => ({ date: p.date, value: p.close }))
  );
  const qqqReturn = computeBenchmarkReturn(
    qqqPrices
      .filter((p) => activeDateSet.has(p.date))
      .map((p) => ({ date: p.date, value: p.close }))
  );

  const performance: PerformancePoint[] = assemblePerformancePoints(
    portfolioReturn,
    spyReturn,
    qqqReturn
  );

  const holdings = computeHoldingsSnapshot(transactions, valuations, options.tickerNames);

  const snapshot: PortfolioSnapshot = {
    asOfDate,
    performance,
    // No real intraday data source in this phase (see the phase
    // report) — deliberately empty, never fabricated. The frontend
    // wiring phase should pair the mock -> real switch with the
    // previously recommended 1D removal / 5D-from-daily-series change,
    // rather than shipping a snapshot with broken 1D/5D views.
    intraday: [],
    holdings,
  };

  return { status: "ready", snapshot };
}
