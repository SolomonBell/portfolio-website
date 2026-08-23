// Centralized provider/symbol configuration. The public benchmark labels
// ("S&P 500", "NASDAQ-100") and the ETF symbols currently proxying them
// (SPY, QQQ) are configured here, and ONLY here — nothing else in the
// codebase should hardcode the literal strings "SPY"/"QQQ".
//
// These are ETF PRICE-RETURN proxies, not the actual indices, and not
// total-return series. APIStocks' `AdjClose` field has not been verified
// to include dividend/distribution adjustments (a manual test around a
// known SPY dividend date showed AdjClose === Close), so this
// implementation deliberately uses `Close` only — see apistocks.ts and
// the price-return methodology note in ../portfolio/twr.ts.

export const RAPIDAPI_HOST = "apistocks.p.rapidapi.com";

/** Name of the server-only environment variable holding the RapidAPI key. */
export const RAPIDAPI_KEY_ENV_VAR = "RAPIDAPI_KEY";

export type BenchmarkKey = "sp500" | "nasdaq100";

export const BENCHMARKS: Record<BenchmarkKey, { label: string; symbol: string }> = {
  sp500: { label: "S&P 500", symbol: "SPY" },
  nasdaq100: { label: "NASDAQ-100", symbol: "QQQ" },
};
