// APIStocks adapter (via RapidAPI). This is the ONLY file in the codebase
// that knows APIStocks' request/response shape — everything downstream
// consumes the normalized `DailyPricePoint[]` shape from provider.ts.
//
// IMPORTANT — use `Close`, never `AdjClose`: a manual test against SPY
// around a known dividend date showed AdjClose === Close on both the
// day before and the day of the distribution, so we have no evidence
// AdjClose reflects dividend adjustment. Treating it as total return
// would be presenting price return as total return, which we don't do
// anywhere in this codebase. See config.ts and ../portfolio/twr.ts for
// the resulting price-return methodology.
//
// IMPORTANT — split-adjusted history: a manual AAPL test around its 2020
// 4-for-1 split showed pre-split `Close` values already in post-split
// terms (~$125, not ~$500). APIStocks' daily history is therefore
// split-adjusted, not raw. The portfolio engine's valuation layer has a
// dedicated "split-adjusted" price convention (see
// ../portfolio/valuation.ts) specifically to consume data in this shape
// without double-counting a ledger SPLIT transaction on top of it.

import { RAPIDAPI_HOST, RAPIDAPI_KEY_ENV_VAR } from "./config";
import { MarketDataError, type DailyPricePoint, type MarketDataProvider } from "./provider";

type ApiStocksResult = {
  Date: string;
  Open: number;
  Close: number;
  High: number;
  Low: number;
  Volume: number;
  AdjClose: number;
};

type ApiStocksResponse = {
  Metadata: { Symbol: string; Interval: string; Timezone: string };
  Results: ApiStocksResult[];
};

/** Reads the server-only RapidAPI key. Never log or return this value. */
export function getRapidApiKey(): string {
  const key = process.env[RAPIDAPI_KEY_ENV_VAR];
  if (!key) {
    throw new MarketDataError(
      `${RAPIDAPI_KEY_ENV_VAR} environment variable is not set (server-only; see .env.local / Vercel project settings)`
    );
  }
  return key;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Pure normalization of an APIStocks `/daily` response body into sorted,
 * validated `DailyPricePoint[]` using `Close` only. Exported separately
 * from the network call so tests can exercise it with fixtures, without
 * making a live HTTP request.
 */
export function normalizeApiStocksResponse(symbol: string, body: unknown): DailyPricePoint[] {
  if (
    typeof body !== "object" ||
    body === null ||
    !("Results" in body) ||
    !Array.isArray((body as { Results: unknown }).Results)
  ) {
    throw new MarketDataError(`APIStocks response for ${symbol} is missing a "Results" array`);
  }

  const results = (body as ApiStocksResponse).Results;
  const points: DailyPricePoint[] = results.map((row, i) => {
    if (typeof row?.Date !== "string" || row.Date.length === 0) {
      throw new MarketDataError(`APIStocks result ${i} for ${symbol} has an invalid Date field`);
    }
    if (!isFiniteNumber(row.Close)) {
      throw new MarketDataError(
        `APIStocks result ${i} for ${symbol} (${row.Date}) has an invalid Close field`
      );
    }
    return { date: row.Date, close: row.Close };
  });

  return [...points].sort((a, b) => a.date.localeCompare(b.date));
}

export class ApiStocksProvider implements MarketDataProvider {
  async getDailyCloses(
    symbol: string,
    dateStart: string,
    dateEnd: string
  ): Promise<DailyPricePoint[]> {
    const url = new URL(`https://${RAPIDAPI_HOST}/daily`);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("dateStart", dateStart);
    url.searchParams.set("dateEnd", dateEnd);

    const res = await fetch(url, {
      headers: {
        "x-rapidapi-host": RAPIDAPI_HOST,
        "x-rapidapi-key": getRapidApiKey(),
      },
      // Daily/EOD data — refresh at most once a day rather than on every
      // request. See app/lib/market-data/README (or the phase report) for
      // the equivalent Vercel/Next.js caching notes.
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      throw new MarketDataError(
        `APIStocks request failed for ${symbol}: ${res.status} ${res.statusText}`
      );
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new MarketDataError(`APIStocks returned a non-JSON response for ${symbol}`);
    }

    return normalizeApiStocksResponse(symbol, body);
  }
}
