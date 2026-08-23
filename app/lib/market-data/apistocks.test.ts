import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiStocksProvider, getRapidApiKey, normalizeApiStocksResponse } from "./apistocks";
import { MarketDataError } from "./provider";

function fixture(
  results: Array<{ Date: string; Close: number; AdjClose?: number }>
) {
  return {
    Metadata: { Symbol: "SPY", Interval: "daily", Timezone: "America/New_York" },
    Results: results.map((r) => ({
      Date: r.Date,
      Open: r.Close,
      Close: r.Close,
      High: r.Close,
      Low: r.Close,
      Volume: 1000,
      AdjClose: r.AdjClose ?? r.Close,
    })),
  };
}

describe("1 — valid APIStocks daily response parsing", () => {
  it("normalizes a well-formed response", () => {
    const body = fixture([
      { Date: "2026-01-01", Close: 100 },
      { Date: "2026-01-02", Close: 101 },
    ]);
    expect(normalizeApiStocksResponse("SPY", body)).toEqual([
      { date: "2026-01-01", close: 100 },
      { date: "2026-01-02", close: 101 },
    ]);
  });
});

describe("2 — chronological normalization", () => {
  it("sorts results ascending by date even when provider order is unspecified", () => {
    const body = fixture([
      { Date: "2026-01-02", Close: 101 },
      { Date: "2026-01-01", Close: 100 },
      { Date: "2026-01-03", Close: 102 },
    ]);
    expect(normalizeApiStocksResponse("SPY", body).map((p) => p.date)).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
    ]);
  });
});

describe("3 — API response arriving out of order", () => {
  it("handles a fully reversed response", () => {
    const body = fixture([
      { Date: "2026-01-03", Close: 102 },
      { Date: "2026-01-02", Close: 101 },
      { Date: "2026-01-01", Close: 100 },
    ]);
    const result = normalizeApiStocksResponse("SPY", body);
    expect(result[0].date).toBe("2026-01-01");
    expect(result[2].date).toBe("2026-01-03");
  });
});

describe("4 — empty results", () => {
  it("returns an empty array without throwing", () => {
    expect(normalizeApiStocksResponse("SPY", fixture([]))).toEqual([]);
  });
});

describe("5 — invalid result fields", () => {
  it("throws on a missing Date", () => {
    const body = { Metadata: {}, Results: [{ Close: 100 }] };
    expect(() => normalizeApiStocksResponse("SPY", body)).toThrow(MarketDataError);
  });

  it("throws on a non-numeric Close", () => {
    const body = { Metadata: {}, Results: [{ Date: "2026-01-01", Close: "n/a" }] };
    expect(() => normalizeApiStocksResponse("SPY", body)).toThrow(MarketDataError);
  });

  it("throws on a NaN Close", () => {
    const body = { Metadata: {}, Results: [{ Date: "2026-01-01", Close: NaN }] };
    expect(() => normalizeApiStocksResponse("SPY", body)).toThrow(MarketDataError);
  });

  it("throws when the response has no Results array at all", () => {
    expect(() => normalizeApiStocksResponse("SPY", { Metadata: {} })).toThrow(MarketDataError);
    expect(() => normalizeApiStocksResponse("SPY", null)).toThrow(MarketDataError);
    expect(() => normalizeApiStocksResponse("SPY", "not json")).toThrow(MarketDataError);
  });
});

describe("6 — non-200 / API error", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("throws MarketDataError on a non-ok HTTP response", async () => {
    vi.stubEnv("RAPIDAPI_KEY", "test-key");
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
    }) as unknown as typeof fetch;

    const provider = new ApiStocksProvider();
    await expect(
      provider.getDailyCloses("SPY", "2026-01-01", "2026-01-02")
    ).rejects.toThrow(MarketDataError);
  });
});

describe("7 — SPY configuration", () => {
  it("normalizes SPY responses using Close", () => {
    const body = fixture([{ Date: "2026-01-01", Close: 450.12, AdjClose: 450.12 }]);
    expect(normalizeApiStocksResponse("SPY", body)).toEqual([
      { date: "2026-01-01", close: 450.12 },
    ]);
  });
});

describe("8 — QQQ configuration", () => {
  it("normalizes QQQ responses using Close", () => {
    const body = fixture([{ Date: "2026-01-01", Close: 380.5, AdjClose: 380.5 }]);
    expect(normalizeApiStocksResponse("QQQ", body)).toEqual([
      { date: "2026-01-01", close: 380.5 },
    ]);
  });
});

describe("9 — correct use of Close, not AdjClose", () => {
  it("uses Close even when AdjClose differs, matching the verified SPY dividend-date behavior", () => {
    // Reproduces the manually verified case: Close and AdjClose were
    // identical around a known SPY dividend event, so we have no
    // evidence AdjClose reflects dividend adjustment. This test also
    // guards against a future regression that starts reading AdjClose.
    const body = fixture([
      { Date: "2021-09-16", Close: 447.170013, AdjClose: 447.170013 },
      { Date: "2021-09-17", Close: 441.399994, AdjClose: 441.399994 },
    ]);
    const result = normalizeApiStocksResponse("SPY", body);
    expect(result[0].close).toBe(447.170013);
    expect(result[1].close).toBe(441.399994);

    // Even if AdjClose diverged from Close, normalization must still
    // pick Close.
    const divergent = fixture([{ Date: "2026-01-01", Close: 100, AdjClose: 95 }]);
    expect(normalizeApiStocksResponse("SPY", divergent)[0].close).toBe(100);
  });
});

describe("14 — API key remains server-only", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws rather than silently proceeding when RAPIDAPI_KEY is unset", () => {
    vi.stubEnv("RAPIDAPI_KEY", "");
    expect(() => getRapidApiKey()).toThrow(MarketDataError);
  });

  it("reads the key from the server-only RAPIDAPI_KEY env var (no NEXT_PUBLIC_ prefix)", () => {
    vi.stubEnv("RAPIDAPI_KEY", "test-key-value");
    expect(getRapidApiKey()).toBe("test-key-value");
  });
});
