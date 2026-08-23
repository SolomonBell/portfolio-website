// DEV-ONLY verification page for the APIStocks pipeline. Not part of the
// public site — never linked from navigation, and hard-blocked outside
// local development below (this doesn't rely on the URL being obscure).
//
// This exercises the real ApiStocksProvider against real SPY/QQQ data
// using the RAPIDAPI_KEY from .env.local, to prove the adapter and
// benchmark-return pipeline actually work end to end before the real
// portfolio exists. It intentionally does NOT render the existing
// PerformanceChart component or fabricate a Portfolio series — see the
// phase report for why (the chart's data contract requires a portfolio
// value at every point, which we have no honest way to supply yet).
//
// Rotate RAPIDAPI_KEY before production deployment — the currently
// configured key was previously exposed and must be treated as
// compromised for anything beyond local development.

import { notFound } from "next/navigation";
import { ApiStocksProvider } from "../../lib/market-data/apistocks";
import { BENCHMARKS } from "../../lib/market-data/config";
import { latestCommonDate } from "../../lib/market-data/dates";
import { computeBenchmarkReturn } from "../../lib/portfolio/benchmark";
import type { DailyPricePoint } from "../../lib/market-data/provider";

export const dynamic = "force-dynamic";

const TEST_WINDOW_DAYS = 45;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function summarize(symbol: string, prices: DailyPricePoint[]) {
  const returns = computeBenchmarkReturn(prices.map((p) => ({ date: p.date, value: p.close })));
  const last = prices[prices.length - 1];
  const lastReturn = returns[returns.length - 1];
  return {
    symbol,
    firstDate: prices[0]?.date ?? "(none)",
    lastDate: last?.date ?? "(none)",
    observations: prices.length,
    latestClose: last?.close ?? null,
    cumulativeReturnPct: lastReturn?.cumulativeReturnPct ?? null,
  };
}

export default async function MarketDataCheckPage() {
  // Hard block outside local development. NODE_ENV is "production" for
  // every Vercel deployment (preview and production both), and
  // "development" only under `next dev` — so this can't accidentally
  // ship live on any deployed environment.
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const dateEnd = todayISO();
  const dateStart = daysAgoISO(TEST_WINDOW_DAYS);
  const provider = new ApiStocksProvider();

  let spy: DailyPricePoint[] | null = null;
  let qqq: DailyPricePoint[] | null = null;
  let error: string | null = null;

  try {
    [spy, qqq] = await Promise.all([
      provider.getDailyCloses(BENCHMARKS.sp500.symbol, dateStart, dateEnd),
      provider.getDailyCloses(BENCHMARKS.nasdaq100.symbol, dateStart, dateEnd),
    ]);
  } catch (e) {
    // Error messages from apistocks.ts never include the key itself.
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main style={{ fontFamily: "monospace", padding: "2rem", maxWidth: 720 }}>
      <h1>Market-data pipeline check (dev only)</h1>
      <p>
        Window: {dateStart} to {dateEnd} ({TEST_WINDOW_DAYS} days) · Provider: APIStocks
      </p>

      {error && (
        <pre style={{ color: "crimson", whiteSpace: "pre-wrap" }}>Error: {error}</pre>
      )}

      {spy && qqq && (
        <>
          {[summarize(BENCHMARKS.sp500.symbol, spy), summarize(BENCHMARKS.nasdaq100.symbol, qqq)].map(
            (s) => (
              <section key={s.symbol} style={{ marginTop: "1.5rem" }}>
                <h2>{s.symbol}</h2>
                <ul>
                  <li>First date: {s.firstDate}</li>
                  <li>Last date: {s.lastDate}</li>
                  <li>Observations: {s.observations}</li>
                  <li>Latest close: {s.latestClose}</li>
                  <li>
                    Cumulative price return over window:{" "}
                    {s.cumulativeReturnPct?.toFixed(2)}%
                  </li>
                </ul>
              </section>
            )
          )}

          <section style={{ marginTop: "1.5rem" }}>
            <h2>Latest common date</h2>
            <p>{latestCommonDate([spy, qqq])}</p>
          </section>
        </>
      )}
    </main>
  );
}
