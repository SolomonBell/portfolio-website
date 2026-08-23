// The real, version-controlled transaction ledger for the personal
// investment portfolio shown on the "Investing" section of the site.
//
// This file is intentionally EMPTY of transactions: the portfolio has
// not been created yet. Do not add placeholder/example transactions
// here — anything in this array is treated by the engine as real
// portfolio history. Examples of the expected shape live in the comment
// block below instead.
//
// See app/lib/portfolio/types.ts for the full `Transaction` type and
// app/lib/portfolio/ledger.ts for validation rules. In short:
//
//   - The ledger must begin with a DEPOSIT — that date is portfolio
//     inception (see the approved architecture report).
//   - BUY/SELL are internal reallocations (cash <-> shares), never
//     external cash flows.
//   - DEPOSIT/WITHDRAWAL are the only external cash flows.
//   - DIVIDEND is investment return credited to cash, not a deposit.
//   - SPLIT never rewrites a historical BUY/SELL — it prospectively
//     adjusts share count from its effective date forward. Price data
//     fed into the engine for a split ticker must be RAW/unadjusted;
//     see the split-adjustment note in app/lib/portfolio/types.ts.
//
// Example shape (NOT real data — do not uncomment as-is):
//
// import type { Transaction } from "../app/lib/portfolio/types";
//
// export const transactions: Transaction[] = [
//   { id: "2026-09-01-deposit-1", date: "2026-09-01", type: "DEPOSIT", amount: 5000 },
//   { id: "2026-09-01-buy-aapl", date: "2026-09-01", type: "BUY", ticker: "AAPL", shares: 10, price: 220.5, fee: 0 },
//   { id: "2026-09-15-div-aapl", date: "2026-09-15", type: "DIVIDEND", ticker: "AAPL", amount: 2.6 },
//   { id: "2026-10-01-deposit-2", date: "2026-10-01", type: "DEPOSIT", amount: 1000 },
//   { id: "2026-11-01-sell-aapl", date: "2026-11-01", type: "SELL", ticker: "AAPL", shares: 4, price: 235, fee: 0 },
//   { id: "2027-01-15-split-aapl", date: "2027-01-15", type: "SPLIT", ticker: "AAPL", ratio: [2, 1] },
// ];

import type { Transaction } from "../app/lib/portfolio/types";

export const transactions: Transaction[] = [];
