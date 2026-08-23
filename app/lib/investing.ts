// Mock investing data for the homepage "Investing" section.
//
// Shape is designed so a real market-data/portfolio API response can be
// dropped in later without touching the chart or summary rendering logic:
// - `performance` is a daily time series of cumulative % returns.
// - `intraday` is a finer-grained time series covering the most recent
//   trading days, used for the 1D/5D ranges (mirrors how a real quote
//   API typically separates historical daily bars from intraday ticks).
// - `getPerformanceForRange` slices + rebases the right series the same
//   way a real API would need to for a given comparison window.

export type RangeKey = "1D" | "5D" | "1M" | "6M" | "YTD" | "1Y" | "5Y" | "Max";

export const RANGE_OPTIONS: RangeKey[] = [
  "1D",
  "5D",
  "1M",
  "6M",
  "YTD",
  "1Y",
  "5Y",
  "Max",
];

export type PerformancePoint = {
  /** ISO 8601 date or datetime, e.g. "2026-08-21" or "2026-08-21T14:30:00.000Z" */
  date: string;
  /** Cumulative % return since inception */
  portfolio: number;
  spy: number;
  qqq: number;
};

export type Holding = {
  ticker: string;
  name: string;
  allocationPct: number;
  totalReturnPct: number;
};

export type PortfolioSnapshot = {
  /** ISO date of the most recent data point */
  asOfDate: string;
  /** Daily closes, oldest to newest, spanning the full mock history */
  performance: PerformancePoint[];
  /** Intraday points for the most recent trading days (powers 1D/5D) */
  intraday: PerformancePoint[];
  holdings: Holding[];
};

export const SERIES_META = [
  { key: "portfolio", label: "Placeholder Portfolio", color: "#fafafa", width: 2.5 },
  { key: "spy", label: "S&P 500", color: "#38bdf8", width: 1.75 },
  { key: "qqq", label: "NASDAQ-100", color: "#a78bfa", width: 1.75 },
] as const satisfies readonly {
  key: "portfolio" | "spy" | "qqq";
  label: string;
  color: string;
  width: number;
}[];

// --- Deterministic mock series generation -----------------------------
// Uses a seeded PRNG (not Math.random) so server and client render the
// same values and the site doesn't hydrate with mismatched data.

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededGaussian(rand: () => number) {
  const u = Math.max(rand(), 1e-9);
  const v = Math.max(rand(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function businessDaysEnding(endISO: string, count: number): string[] {
  const end = new Date(`${endISO}T00:00:00Z`);
  const dates: string[] = [];
  const cursor = new Date(end);

  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.unshift(cursor.toISOString());
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return dates;
}

/**
 * Generates three cumulative-return series (portfolio/SPY/QQQ) driven by a
 * shared daily market factor plus per-series idiosyncratic noise, so the
 * lines co-move the way real equity/index returns do instead of drifting
 * as unrelated random walks. The portfolio shares extra idiosyncratic
 * correlation with QQQ since its mock holdings are NASDAQ-100 mega-caps.
 */
function generateCorrelatedReturns(
  length: number,
  seed: number
): { portfolio: number[]; spy: number[]; qqq: number[] } {
  const rand = mulberry32(seed);

  const spyMean = 0.00022;
  const spyVol = 0.0072;
  const qqqMean = 0.00032;
  const qqqVol = 0.0095;
  const portfolioMean = 0.00045;
  const portfolioVol = 0.0105;

  const portfolio: number[] = [0];
  const spy: number[] = [0];
  const qqq: number[] = [0];
  let gp = 1;
  let gs = 1;
  let gq = 1;

  for (let i = 1; i < length; i++) {
    const zMkt = seededGaussian(rand);
    const zSpyIdio = seededGaussian(rand);
    const zQqqIdio = seededGaussian(rand);
    const zPortIdio = seededGaussian(rand);

    const spyShock = 0.9 * zMkt + 0.436 * zSpyIdio;
    const qqqShock = 0.8 * zMkt + 0.6 * zQqqIdio;
    const portShock = 0.65 * zMkt + 0.55 * zQqqIdio + 0.52 * zPortIdio;

    gs *= 1 + spyMean + spyVol * spyShock;
    gq *= 1 + qqqMean + qqqVol * qqqShock;
    gp *= 1 + portfolioMean + portfolioVol * portShock;

    spy.push((gs - 1) * 100);
    qqq.push((gq - 1) * 100);
    portfolio.push((gp - 1) * 100);
  }

  return { portfolio, spy, qqq };
}

/**
 * Bridges a single trading day between two known daily-close cumulative
 * returns (a "Brownian bridge"), so the intraday path starts exactly at
 * the prior close and lands exactly on the current close while still
 * wiggling in between — deterministic, but visually plausible.
 */
function generateIntradayDay(
  dayISO: string,
  prevClosePct: number,
  closePct: number,
  seed: number,
  pointsPerDay: number
): { date: string; value: number }[] {
  const rand = mulberry32(seed);
  const steps = pointsPerDay - 1;

  const increments: number[] = [];
  for (let i = 0; i < steps; i++) increments.push(seededGaussian(rand));
  const cumulative: number[] = [0];
  for (let i = 0; i < steps; i++) cumulative.push(cumulative[i] + increments[i]);
  const total = cumulative[steps];

  const logStart = Math.log(1 + prevClosePct / 100);
  const logEnd = Math.log(1 + closePct / 100);
  const dayOnly = dayISO.slice(0, 10);
  const startMinutes = 9 * 60 + 30; // 9:30
  const minutesPerStep = 30;

  const points: { date: string; value: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    const bridge = cumulative[i] - t * total;
    const logValue = logStart + t * (logEnd - logStart) + bridge * 0.0035;
    const value = (Math.exp(logValue) - 1) * 100;

    const totalMinutes = startMinutes + i * minutesPerStep;
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const mm = String(totalMinutes % 60).padStart(2, "0");
    points.push({ date: `${dayOnly}T${hh}:${mm}:00.000Z`, value });
  }

  return points;
}

const AS_OF_DATE = "2026-08-21";
const TRADING_DAYS = 1764; // ~7 years of business days, so 5Y and Max are distinct
const INTRADAY_DAYS = 5;
const POINTS_PER_DAY = 14; // 9:30–16:00 in 30-minute steps

const dates = businessDaysEnding(AS_OF_DATE, TRADING_DAYS);
const {
  portfolio: portfolioReturns,
  spy: spyReturns,
  qqq: qqqReturns,
} = generateCorrelatedReturns(TRADING_DAYS, 4903);

const performance: PerformancePoint[] = dates.map((date, i) => ({
  date,
  portfolio: portfolioReturns[i],
  spy: spyReturns[i],
  qqq: qqqReturns[i],
}));

function buildIntradaySeries(
  dailyReturns: number[],
  seedBase: number
): { date: string; value: number }[] {
  const points: { date: string; value: number }[] = [];
  for (let d = TRADING_DAYS - INTRADAY_DAYS; d < TRADING_DAYS; d++) {
    const day = generateIntradayDay(
      dates[d],
      dailyReturns[d - 1],
      dailyReturns[d],
      seedBase * 1000 + d,
      POINTS_PER_DAY
    );
    points.push(...day);
  }
  return points;
}

const portfolioIntraday = buildIntradaySeries(portfolioReturns, 11);
const spyIntraday = buildIntradaySeries(spyReturns, 22);
const qqqIntraday = buildIntradaySeries(qqqReturns, 33);

const intraday: PerformancePoint[] = portfolioIntraday.map((p, i) => ({
  date: p.date,
  portfolio: p.value,
  spy: spyIntraday[i].value,
  qqq: qqqIntraday[i].value,
}));

const holdings: Holding[] = [
  { ticker: "NVDA", name: "NVIDIA Corp.", allocationPct: 24, totalReturnPct: 61.8 },
  { ticker: "MSFT", name: "Microsoft Corp.", allocationPct: 21, totalReturnPct: 24.3 },
  { ticker: "AAPL", name: "Apple Inc.", allocationPct: 18, totalReturnPct: 12.7 },
  { ticker: "GOOGL", name: "Alphabet Inc.", allocationPct: 16, totalReturnPct: 19.5 },
  { ticker: "AMZN", name: "Amazon.com Inc.", allocationPct: 13, totalReturnPct: 15.1 },
  { ticker: "JPM", name: "JPMorgan Chase & Co.", allocationPct: 8, totalReturnPct: 9.4 },
];

export const mockPortfolio: PortfolioSnapshot = {
  asOfDate: AS_OF_DATE,
  performance,
  intraday,
  holdings,
};

// --- Selectors ----------------------------------------------------------

type DailyRangeKey = Exclude<RangeKey, "1D" | "5D">;

function rangeStartDate(range: DailyRangeKey, asOfISO: string): Date {
  const asOf = new Date(`${asOfISO}T00:00:00Z`);
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
 * Exported so the server-side portfolio engine (app/lib/portfolio/range.ts)
 * can reuse this exact compounding-rebase math for real data instead of
 * reimplementing it — see the approved architecture report ("preserve the
 * existing range/rebase architecture wherever mathematically appropriate").
 * Behavior/signature unchanged; this is purely an added export.
 */
export function rebaseSeries(slice: PerformancePoint[]): PerformancePoint[] {
  if (slice.length === 0) return [];

  const base = slice[0];
  const rebase = (value: number, baseValue: number) =>
    ((1 + value / 100) / (1 + baseValue / 100) - 1) * 100;

  return slice.map((p) => ({
    date: p.date,
    portfolio: rebase(p.portfolio, base.portfolio),
    spy: rebase(p.spy, base.spy),
    qqq: rebase(p.qqq, base.qqq),
  }));
}

/**
 * Slices the mock history to the requested range and rebases every
 * series so it starts at ~0% at the beginning of that window. Rebasing
 * compounds the cumulative-from-inception returns rather than naively
 * subtracting, since these are percentage growth figures, not linear
 * values. 1D/5D pull from the intraday series; everything else pulls
 * from daily closes.
 */
export function getPerformanceForRange(
  snapshot: PortfolioSnapshot,
  range: RangeKey
): PerformancePoint[] {
  if (range === "1D") {
    return rebaseSeries(snapshot.intraday.slice(-POINTS_PER_DAY));
  }
  if (range === "5D") {
    return rebaseSeries(snapshot.intraday);
  }

  const start = rangeStartDate(range, snapshot.asOfDate);
  const points = snapshot.performance;
  const startIndex = Math.max(
    0,
    points.findIndex((p) => new Date(p.date) >= start)
  );

  return rebaseSeries(points.slice(startIndex));
}

// --- Formatters -----------------------------------------------------------

export function formatPercent(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(digits)}%`;
}

export function formatPercentagePoints(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(digits)} pp`;
}

const AP_MONTHS_ABBR = [
  "Jan.",
  "Feb.",
  "March",
  "April",
  "May",
  "June",
  "July",
  "Aug.",
  "Sept.",
  "Oct.",
  "Nov.",
  "Dec.",
];

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatClock(d: Date): string {
  let hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

/** e.g. "Aug. 21, 2026" (AP style), for the data-through disclosure line */
export function formatAsOfDate(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  return `${AP_MONTHS_ABBR[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** e.g. "Aug 10, 2026" for the chart tooltip, with a time for 1D/5D */
export function formatTooltipDate(dateISO: string, range: RangeKey): string {
  const d = new Date(dateISO);
  const dateStr = `${SHORT_MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  if (range === "1D" || range === "5D") {
    return `${dateStr}, ${formatClock(d)}`;
  }
  return dateStr;
}

// --- X-axis tick candidates ------------------------------------------------
// Each range has a fixed label unit (hour / trading day / month / year).
// These functions derive tick candidates from the actual calendar
// boundaries for that unit — never arbitrary evenly-spaced dates then
// formatted down — so two candidates can never collapse to the same
// label. The chart still thins this candidate list for width/collisions,
// but it always thins *within* the correct unit for the selected range.

/** One tick per trading hour (market open, each top-of-hour point, and
 * market close), for the 1D range. */
export function getHourTicks(points: PerformancePoint[]): string[] {
  if (points.length === 0) return [];

  const ticks: string[] = [points[0].date];
  for (let i = 1; i < points.length - 1; i++) {
    if (new Date(points[i].date).getUTCMinutes() === 0) {
      ticks.push(points[i].date);
    }
  }

  const last = points[points.length - 1].date;
  if (last !== ticks[ticks.length - 1]) ticks.push(last);
  return ticks;
}

/** One tick per trading day, for the 5D and 1M ranges. */
export function getTradingDayTicks(points: PerformancePoint[]): string[] {
  const ticks: string[] = [];
  let lastKey = "";
  for (const p of points) {
    const key = p.date.slice(0, 10);
    if (key !== lastKey) {
      ticks.push(p.date);
      lastKey = key;
    }
  }
  return ticks;
}

/**
 * One tick per calendar month, in chronological order, for the 6M / YTD /
 * 1Y ranges — so each month label appears at most once. Recharts' own
 * automatic tick spacing chooses ticks by even pixel/index gaps, not by
 * label content, so it can't guarantee that on its own.
 */
export function getMonthTicks(points: PerformancePoint[]): string[] {
  const ticks: string[] = [];
  let lastKey = "";
  for (const p of points) {
    const d = new Date(p.date);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    if (key !== lastKey) {
      ticks.push(p.date);
      lastKey = key;
    }
  }
  return ticks;
}

/** Same idea as `getMonthTicks`, but one representative point per year — the
 * coarser scale used for multi-year ranges (5Y, Max). */
export function getYearTicks(points: PerformancePoint[]): string[] {
  const ticks: string[] = [];
  let lastYear = -1;
  for (const p of points) {
    const year = new Date(p.date).getUTCFullYear();
    if (year !== lastYear) {
      ticks.push(p.date);
      lastYear = year;
    }
  }
  return ticks;
}

/** Short axis label, tuned per range so labels stay legible at any width */
export function formatAxisDate(dateISO: string, range: RangeKey): string {
  const d = new Date(dateISO);

  if (range === "1D") return formatClock(d);
  if (range === "5D") return `${WEEKDAYS_SHORT[d.getUTCDay()]} ${d.getUTCDate()}`;
  if (range === "1M") return `${SHORT_MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  if (range === "6M" || range === "YTD" || range === "1Y") {
    return SHORT_MONTHS[d.getUTCMonth()];
  }

  // 5Y, Max
  return `${d.getUTCFullYear()}`;
}
