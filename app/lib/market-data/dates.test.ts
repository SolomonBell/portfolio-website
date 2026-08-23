import { describe, expect, it } from "vitest";
import { commonDates, latestCommonDate } from "./dates";

describe("10 — latest-common-date calculation", () => {
  it("returns the latest date shared by every series", () => {
    const portfolioHolding = [
      { date: "2026-08-18", close: 10 },
      { date: "2026-08-19", close: 11 },
      { date: "2026-08-20", close: 12 },
    ];
    const spy = [
      { date: "2026-08-18", close: 450 },
      { date: "2026-08-19", close: 451 },
      { date: "2026-08-20", close: 452 },
      { date: "2026-08-21", close: 453 }, // ahead of the holding above
    ];
    const qqq = [
      { date: "2026-08-18", close: 380 },
      { date: "2026-08-19", close: 381 },
      { date: "2026-08-20", close: 382 },
    ];

    expect(latestCommonDate([portfolioHolding, spy, qqq])).toBe("2026-08-20");
  });

  it("does not use today's date or any single series' latest date", () => {
    const laggingSymbol = [{ date: "2026-08-19", close: 10 }];
    const upToDateSymbol = [
      { date: "2026-08-19", close: 100 },
      { date: "2026-08-20", close: 101 },
      { date: "2026-08-21", close: 102 },
    ];
    // The common floor is 08-19, even though upToDateSymbol has data
    // through 08-21.
    expect(latestCommonDate([laggingSymbol, upToDateSymbol])).toBe("2026-08-19");
  });

  it("returns null when no date is shared by every series", () => {
    const a = [{ date: "2026-08-18", close: 10 }];
    const b = [{ date: "2026-08-19", close: 10 }];
    expect(latestCommonDate([a, b])).toBeNull();
  });

  it("returns null for an empty list of series", () => {
    expect(latestCommonDate([])).toBeNull();
  });
});

describe("commonDates", () => {
  it("returns the full sorted intersection, excluding a single-day gap in one series", () => {
    const a = [
      { date: "2026-08-18", close: 1 },
      { date: "2026-08-19", close: 1 },
      { date: "2026-08-20", close: 1 },
    ];
    const bWithGap = [
      { date: "2026-08-18", close: 1 },
      // 08-19 missing — a single-day gap in this symbol's feed
      { date: "2026-08-20", close: 1 },
    ];
    expect(commonDates([a, bWithGap])).toEqual(["2026-08-18", "2026-08-20"]);
  });

  it("returns all dates of a single series unchanged", () => {
    const a = [{ date: "2026-08-18", close: 1 }, { date: "2026-08-19", close: 1 }];
    expect(commonDates([a])).toEqual(["2026-08-18", "2026-08-19"]);
  });
});
