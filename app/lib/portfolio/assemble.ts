// Combines a portfolio TWR series and two benchmark return series into
// the exact `PerformancePoint[]` shape the existing public UI already
// consumes (app/lib/investing.ts) — so a future provider-integration
// phase can hand this straight to the frontend with no contract changes.
//
// All three series must share the same dates in the same order (i.e.
// already aligned to a common trading calendar) — reconciling three
// separate provider feeds onto one common date set is the future
// Snapshot Builder's job, not this module's.

import type { PerformancePoint } from "../investing";
import type { TWRPoint } from "./twr";

export class AssembleError extends Error {}

export function assemblePerformancePoints(
  portfolio: TWRPoint[],
  sp500: TWRPoint[],
  nasdaq100: TWRPoint[]
): PerformancePoint[] {
  if (portfolio.length !== sp500.length || portfolio.length !== nasdaq100.length) {
    throw new AssembleError("Portfolio and benchmark series must have equal length");
  }

  return portfolio.map((p, i) => {
    const s = sp500[i];
    const q = nasdaq100[i];
    if (p.date !== s.date || p.date !== q.date) {
      throw new AssembleError(
        `Date mismatch at index ${i}: portfolio=${p.date} sp500=${s.date} nasdaq100=${q.date}`
      );
    }
    return {
      date: p.date,
      portfolio: p.cumulativeReturnPct,
      spy: s.cumulativeReturnPct,
      qqq: q.cumulativeReturnPct,
    };
  });
}
