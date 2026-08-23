// Resolves a selected timeframe to a start date — clamped to portfolio
// inception when the portfolio is younger than the requested range — and
// rebases the assembled performance series to 0% at that date.
//
// This intentionally reuses `rebaseSeries` from ../investing.ts rather
// than reimplementing the compounding rebase math: the existing
// client-side range logic already does exactly the right thing for a
// `PerformancePoint[]` series, real or mock.
//
// 1D/5D are deliberately not modeled here — they're intraday concepts,
// and this engine only produces daily/EOD data (see the approved
// architecture report's recommendation to drop 1D once real data lands).

import { rebaseSeries, type PerformancePoint } from "../investing";

export type EngineRangeKey = "1M" | "6M" | "YTD" | "1Y" | "5Y" | "Max";

function nominalRangeStart(range: EngineRangeKey, asOf: Date): Date {
  const start = new Date(asOf);

  switch (range) {
    case "1M":
      start.setUTCMonth(start.getUTCMonth() - 1);
      return start;
    case "6M":
      start.setUTCMonth(start.getUTCMonth() - 6);
      return start;
    case "YTD":
      return new Date(Date.UTC(asOf.getUTCFullYear(), 0, 1));
    case "1Y":
      start.setUTCFullYear(start.getUTCFullYear() - 1);
      return start;
    case "5Y":
      start.setUTCFullYear(start.getUTCFullYear() - 5);
      return start;
    case "Max":
      return new Date(0);
  }
}

/**
 * `points` must already be a common-dated Portfolio/S&P 500/NASDAQ-100
 * series (e.g. the output of `assemblePerformancePoints`), starting at
 * portfolio inception. Determines the range's nominal start date, clamps
 * it to inception if the portfolio is younger than the requested range,
 * then rebases all three series to 0.00% at that (possibly clamped)
 * common starting point.
 */
export function getRangeForPerformance(
  points: PerformancePoint[],
  range: EngineRangeKey,
  asOfDate: string,
  inceptionDate: string
): PerformancePoint[] {
  if (points.length === 0) return [];

  const asOf = new Date(`${asOfDate}T00:00:00Z`);
  const inception = new Date(`${inceptionDate}T00:00:00Z`);
  const nominalStart = nominalRangeStart(range, asOf);
  const start = nominalStart < inception ? inception : nominalStart;

  const startIndex = Math.max(
    0,
    points.findIndex((p) => new Date(p.date) >= start)
  );

  return rebaseSeries(points.slice(startIndex));
}
