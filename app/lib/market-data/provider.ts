// Common, provider-independent market-data interface. Nothing in the
// portfolio engine (app/lib/portfolio/) imports a provider directly —
// everything goes through this shape, so swapping providers later means
// writing one new adapter file, not touching the engine or the UI.

export type DailyPricePoint = {
  date: string;
  /** Unadjusted closing price, as actually traded that day. */
  close: number;
};

export class MarketDataError extends Error {}

export interface MarketDataProvider {
  /**
   * Daily closes for `symbol` between `dateStart` and `dateEnd`
   * (inclusive, ISO "YYYY-MM-DD"), sorted chronologically ascending.
   * Throws `MarketDataError` on any request failure or malformed
   * response — never returns partial or fabricated data.
   */
  getDailyCloses(symbol: string, dateStart: string, dateEnd: string): Promise<DailyPricePoint[]>;
}
