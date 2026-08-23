// Provider-independent benchmark return calculation.
//
// An index/ETF has no external cash flows of its own — its own return
// *is* its time-weighted return, trivially, since there's only ever one
// "holder." So no cash-flow simulation is needed here: this is a plain
// rebase of a total-return series to 0% at its first point.
//
//   benchmarkReturn_t = benchmarkValue_t / benchmarkValue_start - 1
//
// `series` must already be a TOTAL-RETURN series (dividend/distribution
// adjusted), not a raw price series — see the note in types.ts and the
// architecture report. Which literal symbol/provider supplies that
// series (e.g. an ETF proxy such as SPY, or an actual index) is a
// concern for the future market-data adapter, not this module.

import type { TWRPoint } from "./twr";

export type BenchmarkPoint = {
  date: string;
  /** Total-return index/price value on this date. */
  value: number;
};

export function computeBenchmarkReturn(series: BenchmarkPoint[]): TWRPoint[] {
  if (series.length === 0) return [];

  const base = series[0].value;
  if (!(base > 0)) {
    throw new Error("Benchmark series must start from a positive value");
  }

  return series.map((p) => ({
    date: p.date,
    cumulativeReturnPct: (p.value / base - 1) * 100,
  }));
}
