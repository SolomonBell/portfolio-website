# Personal Portfolio Website

## Overview

A personal portfolio website for **[solomonbell.com](https://solomonbell.com)**, built with Next.js (App Router), React, TypeScript, and Tailwind CSS. The site presents projects, athletics, and contact information through a cohesive dark-themed UI with an interactive flip-card system, alongside a **Personal Investment Portfolio** showcase section built on a fully custom, tested financial engine.

**Important:** the Investing section is currently in **placeholder mode**. It displays clearly-labeled sample holdings and mock performance data — see [Investing / Portfolio Section](#investing--portfolio-section) below. It does not currently represent any real investment activity.

The site is deployed on Vercel with the custom domain managed through Cloudflare DNS, and tracked with Google Analytics.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI Library | React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Charting | Recharts |
| Testing | Vitest |
| Deployment | Vercel |
| DNS | Cloudflare |
| Market Data | APIStocks (via RapidAPI) |
| Analytics | Google Analytics (gtag.js) |

## Features

- **Interactive flip cards** — project cards reveal detail on hover (desktop) or tap (mobile), using pointer-type detection to drive distinct interaction modes
- **Horizontal scroll carousel** — projects browse naturally on any screen size without pagination
- **Personal Investment Portfolio showcase** — an interactive performance chart, benchmark comparison, and holdings display; see [below](#investing--portfolio-section) for full detail
- **Responsive, mobile-first layout** — consistent experience across phones, tablets, and desktops
- **Single-page navigation** — anchor-linked sections (About, Projects, Investing, Athletics, Contact) with a sticky navbar
- **Resume download** — direct link to a hosted resume from the navbar
- **Google Analytics** — page-view tracking injected conditionally via environment variable, with no client-side bundle cost when the ID is absent
- **Vercel deployment** — zero-config CI/CD on every push to `main`

> **Certificates section — currently hidden:** a Certificates section (with its own flip-card variant, `CertFlipCard`) is fully implemented but temporarily disabled on the public site. The implementation, data, and assets are untouched — only the import/render in `app/page.tsx` and the nav entry in `app/lib/constants.ts` are commented out. Uncomment both to restore it.

## Project Structure

```text
app/
├── layout.tsx                  # Root layout — metadata, GA script injection, global styles
├── page.tsx                    # Single-page composition of all sections
├── globals.css                 # Tailwind base styles
│
├── components/
│   ├── Navbar.tsx               # Sticky nav with anchor links and resume CTA
│   ├── Section.tsx               # Reusable section wrapper (padding, border, max-width)
│   └── ui/
│       ├── FlipCard.tsx              # Generic flip-card primitive
│       ├── ProjectFlipCard.tsx       # Project variant — image front, skills + links back
│       ├── CertFlipCard.tsx          # Certificate variant — image front, skills back (unused while Certificates is hidden)
│       ├── PerformanceChart.tsx      # Recharts line chart + hover tooltip for Investing
│       └── HoldingsList.tsx          # Holdings allocation cards for Investing
│
├── sections/
│   ├── Hero.tsx                 # Name, tagline, CTA links
│   ├── About.tsx                 # Background, school, location
│   ├── Projects.tsx              # Horizontal scroll of ProjectFlipCards
│   ├── Investing.tsx             # Personal Investment Portfolio section (see below)
│   ├── Certificates.tsx          # Horizontal scroll of CertFlipCards (implemented, not currently rendered — see note above)
│   ├── Athletics.tsx             # Rowing background and training
│   └── Contact.tsx               # Email, LinkedIn, GitHub links
│
├── lib/
│   ├── constants.ts              # Centralised site metadata, nav links, external URLs
│   ├── utils.ts                  # Shared utility helpers
│   ├── investing.ts              # Public PortfolioSnapshot contract + current mock/placeholder data
│   ├── build-portfolio-snapshot.ts  # Orchestrates the real-data pipeline (not yet wired to the UI)
│   ├── portfolio/                # Provider-independent financial engine — see below
│   └── market-data/              # APIStocks adapter + config — the only provider-aware code
│
└── dev/
    └── market-data-check/        # Local-only live-data verification page (404s outside development)

data/
└── transactions.ts               # Real transaction ledger — currently empty

public/
└── images/                       # Project and certificate preview images
```

**Server vs. client boundary:** most components (layout, page, and static sections) are React Server Components. Components with interactivity — the flip cards, the Investing section's range controls and chart tooltip — are marked `"use client"`, keeping the client-side JavaScript bundle minimal elsewhere.

## Local Development

**Prerequisites:** Node.js 18+, npm

```bash
git clone https://github.com/SolomonBell/portfolio-website.git
cd portfolio-website
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

**Available scripts** (from `package.json`):

```bash
npm run dev      # Development server with Fast Refresh
npm run build    # Production build
npm run start    # Serve the production build locally
npm run lint     # Run ESLint
npm run test     # Run the Vitest suite (single run, not watch mode)
```

## Environment Variables

Create a `.env.local` file at the project root (this file is gitignored and must never be committed):

```env
NEXT_PUBLIC_GA_ID=
RAPIDAPI_KEY=
```

### `NEXT_PUBLIC_GA_ID`

Client-visible Google Analytics measurement ID (e.g. `G-XXXXXXXXXX`). The `NEXT_PUBLIC_` prefix is intentional here — this value is meant to reach the browser. Analytics are skipped entirely when it's unset, so local development produces no analytics noise.

### `RAPIDAPI_KEY`

Server-only credential for the APIStocks market-data API (accessed via RapidAPI). Required only for real-data work — the Investing section's current placeholder mode doesn't need it at all, and the site runs fine without it set.

**Security rules for this key:**

- **Never** prefix it with `NEXT_PUBLIC_` — it must stay server-only.
- **Never** commit `.env.local`.
- **Never** reference it from a client component (`"use client"` file).
- **Never** put a real key value in this README or any other committed file — examples above are intentionally blank.

> **Rotation note:** a development RapidAPI credential was exposed during initial setup of the market-data integration. The credential currently used for local development must be **rotated** (regenerated on RapidAPI) before real portfolio data is ever deployed publicly. Do not reuse the exposed credential in Vercel.

## Testing

The project uses [Vitest](https://vitest.dev/) for the financial engine and market-data adapter. As of this writing, the suite is **74/74 tests passing**, lint is clean, and type-checking is clean — but treat those exact numbers as a snapshot, not a permanent guarantee; run the commands yourself for the current state.

```bash
npm run test        # run once
npx vitest           # watch mode
```

Coverage focuses on the parts of the codebase where a bug would produce a wrong number rather than a wrong pixel:

- Transaction ledger validation (chronological sorting, duplicate IDs, insufficient cash/shares, invalid fields)
- Daily valuation and time-weighted return (deposits, withdrawals, buys, sells, dividends, fees, splits, idle cash)
- Benchmark rebasing and selected-range rebasing
- APIStocks response normalization (parsing, chronological sorting, `Close` vs. `AdjClose`, malformed responses)
- Market-data date synchronization across multiple series
- The Snapshot Builder end to end, including the empty-portfolio state

**None of the automated tests make live HTTP calls.** The market-data and Snapshot Builder tests run entirely against mocked/fixture provider responses, so the suite is fast, deterministic, and doesn't consume API quota.

### Development-only market-data verification

`app/dev/market-data-check/page.tsx` is a small Server Component page that exercises the *real* APIStocks connection — useful for confirming the live pipeline works before wiring it to the public UI.

- Route: `http://localhost:3000/dev/market-data-check`
- **Available only when `NODE_ENV === "development"`** — it calls `notFound()` otherwise, so it returns a genuine `404` in any built/deployed environment (Vercel preview and production both set `NODE_ENV=production`). This is not "security by obscurity" — it's an explicit runtime guard, verified against a real production build.
- Fetches real SPY and QQQ daily data for a recent (default 45-day) window and reports: first/last date, observation count, latest close, cumulative price return over the window, and the latest common date between the two series.
- Requires `RAPIDAPI_KEY` to be set; fails closed with a clear (key-value-free) error message if it isn't.
- Never renders or logs the API key.
- This page is **not** part of the public site — it isn't linked from navigation and isn't intended for anyone but a developer running the project locally.

## Investing / Portfolio Section

The `Investing` section (`app/sections/Investing.tsx`) is a Personal Investment Portfolio showcase: an interactive chart comparing portfolio performance against major market benchmarks, plus a holdings breakdown.

### Current public state: Placeholder

**The publicly deployed Investing section currently shows a `Placeholder Portfolio`, not a real one.** Specifically:

- The chart title, series label, and disclosure text all explicitly say "Placeholder" — visitors cannot reasonably mistake it for real performance.
- Both the performance chart and the six sample holdings (AAPL, MSFT, NVDA, AMZN, GOOGL, JPM, with illustrative allocation percentages) are **deterministic mock data**, defined in `app/lib/investing.ts`. They do not represent any actual investment activity.
- `data/transactions.ts` — the real transaction ledger — is **intentionally empty**.
- The real market-data pipeline described below is fully built and tested but **not currently wired to the public component**. `Investing.tsx` still imports and renders `mockPortfolio` from `app/lib/investing.ts`.

This lets the section stay complete and polished while a real portfolio has not yet been established, without ever presenting fabricated numbers as genuine investment results.

### Public UI

At a high level, the Investing section includes:

- An interactive performance chart (cumulative % return, not dollar value)
- Comparison against the **S&P 500**
- Comparison against the **NASDAQ-100**
- Selectable time ranges (`1D`, `5D`, `1M`, `6M`, `YTD`, `1Y`, `5Y`, `Max`)
- A hover tooltip whose rows are dynamically re-ranked highest-to-lowest return for whichever date is hovered
- Return summaries for the selected range
- A holdings allocation display (ticker, company name, allocation %, return % — never dollar values or share counts)
- A disclosure/disclaimer control
- Explanatory text on investment philosophy

Exact styling isn't documented here — it changes independently of the underlying architecture; read the component source for current visual details.

## Real Portfolio Architecture

Even though it isn't wired to the public UI yet, a complete real-data pipeline exists and is tested. Conceptually:

```text
Transaction Ledger
        ↓
Portfolio Engine  (valuation, TWR, splits, benchmarks, range rebasing)
        ↓
APIStocks Market Data  (daily prices for holdings + SPY/QQQ)
        ↓
Snapshot Builder  (orchestrates the above into one result)
        ↓
Investing UI  (existing chart/holdings components — unchanged either way)
```

In practice, the ledger and the market-data adapter are both inputs to the portfolio engine (the ledger determines *which* symbols to fetch; the fetched prices determine *value*) — the diagram above is a simplified read order, not a strict call sequence. The sections below walk through each piece.

### Transaction ledger

`data/transactions.ts` is the **authoritative, version-controlled record** of everything that has happened in the real portfolio. Its type (`Transaction`, defined in `app/lib/portfolio/types.ts`) supports six transaction types:

| Type | Meaning |
|---|---|
| `DEPOSIT` | External cash added to the account |
| `WITHDRAWAL` | External cash removed from the account |
| `BUY` | Cash converted into shares of a security |
| `SELL` | Shares converted back into cash |
| `DIVIDEND` | Cash credited from a held security — investment return, not a deposit |
| `SPLIT` | A prospective share-count adjustment for a ticker (see [Split handling](#split-handling)) |

`DEPOSIT` and `WITHDRAWAL` are the only *external* cash flows — `BUY`/`SELL` are internal reallocations and `DIVIDEND` is investment return, which matters directly for the return methodology below. The ledger currently contains **no transactions**. The first real transaction must be a `DEPOSIT`, of whatever amount is actually deposited — nothing about the amount is hard-coded anywhere in the engine.

### Portfolio engine (`app/lib/portfolio/`)

A provider-independent financial engine — it has no knowledge of APIStocks or any other market-data source, only of transactions and price series handed to it.

- **Ledger validation** (`ledger.ts`) — sorts transactions chronologically (with a deterministic same-day tie-break), rejects duplicate IDs, insufficient cash/shares, invalid quantities, and a ledger that doesn't begin with a `DEPOSIT`.
- **Daily valuation** (`valuation.ts`) — walks the ledger day by day, computing `cash + market value of open positions` for each date. Supports a `"raw"` vs. `"split-adjusted"` price convention (see below).
- **Time-weighted return** (`twr.ts`) — the account's true daily-linked TWR, and a second "price-return" variant used for the public comparison (see [TWR methodology](#twr-methodology)).
- **Benchmark calculation** (`benchmark.ts`) — rebases a benchmark price series to a cumulative % return from its first point.
- **Range rebasing** (`range.ts`) — slices a full-history series to a selected timeframe and rebases it to 0% at that window's start, clamped so it never generates performance before portfolio inception.
- **Holdings snapshot** (`holdings.ts`) — computes the percentage-only public holdings view (ticker, name, allocation %, return %) from the latest valuation — never share counts or dollar values.
- **Performance assembly** (`assemble.ts`) — zips a portfolio return series and two benchmark return series into the exact `PerformancePoint[]` shape the existing chart component already consumes.

### TWR methodology

Two distinct return metrics are computed, deliberately kept separate:

**Account TWR** (`computeTWR`) is the account's actual, true performance — dividends count as investment return, exactly as they should for genuine portfolio accounting.

**Public price-return comparison** (`computePriceReturnTWR`) is what the Investing chart is designed to eventually display. Because the current market-data source doesn't provide verified dividend/distribution-adjusted (total-return) benchmark data for SPY/QQQ, comparing a dividend-inclusive portfolio number against a dividend-excluded benchmark would be an unfair, apples-to-oranges comparison. So the public metric excludes dividend income from the *return calculation* the same way a deposit is excluded — the dividend cash itself is still real and still counted in the account's value, only this specific comparison metric discounts it, to stay consistent with the price-only benchmark series.

**This means the current public comparison is price return, not total return — that distinction is intentional and should not be blurred in any UI copy or documentation.** The two calculations are kept structurally separate specifically so that if a verified total-return benchmark source is added later, switching the public chart over is a small, localized change (use `computeTWR` instead of `computePriceReturnTWR`, and feed `computeBenchmarkReturn` a total-return series) rather than a rewrite.

### Split handling

APIStocks' historical daily prices behave as **split-normalized** for every case tested (a historical price from before a stock split is already expressed in post-split terms). Rather than mutate the immutable transaction ledger to match, the valuation layer has a dedicated `"split-adjusted"` price convention: actual share counts and the ledger's real `SPLIT` transactions are left completely untouched, and only the *valuation math* retroactively rescales historical share counts to line up with the already-adjusted price series. This avoids double-counting a split (once from the ledger, once from the data provider) without ever rewriting historical `BUY`/`SELL` records.

## Market Data Provider: APIStocks

[APIStocks](https://apistocks.com/) (accessed through [RapidAPI](https://rapidapi.com/)) is the current market-data provider, isolated entirely behind `app/lib/market-data/`:

- `provider.ts` — the provider-agnostic interface (`MarketDataProvider`). Nothing outside this folder knows which provider is in use.
- `apistocks.ts` — the concrete APIStocks adapter. **Server-side only** — this module is never imported by a client component.
- `config.ts` — centralized configuration, including the benchmark symbol mapping: the public `S&P 500` label is proxied internally by **SPY**, and the public `NASDAQ-100` label is proxied internally by **QQQ**. These are ETF *price-return* proxies, not the actual indices, and nothing in the codebase hardcodes those ticker strings outside this file.
- `dates.ts` — derives the trading dates common to every required series, used to compute the latest shared "as of" date.

The adapter calls APIStocks' `Daily` endpoint, which returns daily OHLC-style data. The implementation intentionally uses the response's `Close` field. **`AdjClose` is not used** — a manual test around a known SPY dividend date showed `AdjClose` identical to `Close`, so there is no verified evidence it reflects dividend adjustment, and treating it as total return would misrepresent price return as total return.

### Caching

Requests to APIStocks use Next.js's built-in fetch caching:

```ts
fetch(url, { next: { revalidate: 86400 } })
```

Market data is fetched server-side and cached for roughly 24 hours — it is not re-fetched on every visitor request. No additional cache layer (Redis, a database, a Cloudflare Worker) is used or currently needed.

Once the real pipeline is wired up, the public `Data through ...` date will be derived from the **latest trading date common to every required series** (each holding, SPY, and QQQ) — never today's calendar date, and never a date only some of those series have reached.

## Snapshot Builder

`app/lib/build-portfolio-snapshot.ts` orchestrates the full pipeline into `buildPortfolioSnapshot()`:

1. Reads the transaction ledger (`data/transactions.ts` by default; injectable for tests).
2. Determines portfolio inception from the first `DEPOSIT`.
3. Determines every ticker symbol the ledger requires.
4. Fetches daily price history for each holding, plus SPY and QQQ, in parallel.
5. Derives the trading dates common to all of them, gracefully excluding any single-symbol gap rather than failing on it.
6. Builds daily valuations using the `"split-adjusted"` price convention.
7. Computes the public price-return TWR for the portfolio.
8. Computes SPY and QQQ benchmark price returns.
9. Builds the percentage-only holdings snapshot.
10. Assembles everything into the existing `PortfolioSnapshot` frontend contract.
11. Sets `asOfDate` to the latest common trading date found in step 5.

**Empty-ledger behavior:** if there's no `DEPOSIT` in the ledger — the current real state — `buildPortfolioSnapshot()` returns `{ status: "not-started" }` immediately, **before making any market-data request at all**. This is a typed, expected result, not a thrown error — it's deliberately kept distinct from genuine failures (a bad provider response, a missing price), which do throw and propagate rather than being silently absorbed.

## Placeholder → Real Portfolio Transition

When the real portfolio is established, switching the public site over is expected to be small and mechanical — the engine and market-data infrastructure described above do **not** need to be rebuilt. Roughly, in order:

1. Record the real initial `DEPOSIT` in `data/transactions.ts`.
2. Record all real `BUY` transactions.
3. Add ticker → company-name mappings for the real holdings (APIStocks has no name field, so this is supplied manually).
4. Verify the real Snapshot Builder locally (via the dev-only verification page and/or a manual run).
5. Decide how to handle `1D` / intraday functionality (see below).
6. Rotate the development RapidAPI key.
7. Add the new `RAPIDAPI_KEY` to Vercel's server-side environment variables.
8. Wire the Investing section through a Server Component that calls `buildPortfolioSnapshot()` and passes the result to the existing client chart/holdings components.
9. Replace the placeholder labels and disclosure copy with the real portfolio presentation.
10. Let the real `Data through ...` date (derived automatically, per above) replace the placeholder indication.
11. Manually verify computed performance values against the actual brokerage account before deploying.
12. Run tests, lint, type-check, and a production build.
13. Deploy.

## 1D / Intraday Status

Honestly, as of this writing:

- The real integration uses APIStocks' **Daily** (end-of-day) data only.
- APIStocks exposes a separate intraday endpoint, but it has **not** been integrated or validated.
- No synthetic/fabricated intraday data should ever be generated for the real portfolio.
- The current placeholder UI's mock data includes intraday-shaped behavior purely for demonstration purposes — that is not a statement about what the real integration can support.
- The `1D` range's fate (keep it once a genuine intraday source is validated, or remove it in favor of daily-only ranges) needs to be decided as part of the real-data cutover, not assumed either way.

## Deployment

```text
GitHub → Vercel → solomonbell.com
```

- **Vercel** builds and hosts the Next.js application (both the static marketing pages and any server-side execution the market-data integration needs) and provides zero-config CI/CD on every push to `main`.
- **Cloudflare** manages DNS/domain routing for `solomonbell.com` only — it does not host the application itself.
- No Cloudflare Worker, KV, D1, Redis, or separate market-data backend is required by the current architecture. Vercel's built-in server-side execution and fetch caching are sufficient for the once-daily market-data refresh described above.

## Security Considerations

- `RAPIDAPI_KEY` is server-only, never reaches client JavaScript, and is never logged — see [Environment Variables](#environment-variables) above, including the required key rotation before production use.
- There are no brokerage credentials anywhere in this architecture. The transaction ledger is a manually-maintained, version-controlled file, not a live brokerage API/OAuth connection.
- The public data contract (`PortfolioSnapshot`, `Holding`) is percentage-only by construction — it has no fields for dollar portfolio value, dollar amounts invested, cash balance, or share counts, so there's nothing to accidentally leak even once real data is wired in.
- The dev-only market-data verification page is hard-blocked outside local development via a runtime `NODE_ENV` check, verified against an actual production build — not left to depend on the URL being unguessable.

## Future Improvements

- Add project detail pages with full write-ups, architecture diagrams, and lessons learned
- Integrate a lightweight CMS (e.g. Contentlayer or MDX) to manage project and certificate data without touching component code
- Restore the Certificates section (currently hidden — see note above) and expand it with additional coursework and professional certifications
- Add scroll-triggered entrance animations using the Intersection Observer API
- Improve accessibility with ARIA labels on interactive cards and skip-to-content navigation

## Author

**Solomon Bell**
Computer Science & Engineering + Mathematical Economics — Bucknell University
[LinkedIn](https://www.linkedin.com/in/solomonbell) · [GitHub](https://github.com/SolomonBell)
