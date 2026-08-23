// Derives the trading dates common to every required series (each
// portfolio holding, S&P 500 proxy, NASDAQ-100 proxy). This is what
// drives the public "Data through ..." date automatically — never
// today's calendar date, and never a date only some series have reached
// yet — and lets the Snapshot Builder gracefully trim around a gap in
// any single symbol's history instead of throwing.

import type { DailyPricePoint } from "./provider";

/**
 * The full set of dates present in every one of `seriesList`, sorted
 * ascending. A date missing from just one series (a single-day gap in
 * one symbol's feed) is simply excluded, not treated as an error — the
 * comparison window only ever covers dates every required series
 * actually has data for.
 */
export function commonDates(seriesList: DailyPricePoint[][]): string[] {
  if (seriesList.length === 0) return [];

  const dateSets = seriesList.map((series) => new Set(series.map((p) => p.date)));
  const [first, ...rest] = dateSets;
  const common = [...first].filter((d) => rest.every((set) => set.has(d)));

  return common.sort();
}

/**
 * The latest date present in every one of `seriesList`, or `null` if
 * there is no such date (e.g. an empty list, or no date shared by all
 * series).
 */
export function latestCommonDate(seriesList: DailyPricePoint[][]): string | null {
  const dates = commonDates(seriesList);
  return dates.length > 0 ? dates[dates.length - 1] : null;
}
