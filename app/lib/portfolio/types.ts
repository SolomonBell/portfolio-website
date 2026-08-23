// Core types for the portfolio transaction ledger and calculation engine.
//
// This module is intentionally provider-independent: nothing here knows
// about brokerages, market-data APIs, or the public website's data shape
// (`PortfolioSnapshot` in ../investing.ts). It only models "what happened
// to the account" (the ledger) and "what a security was worth on a given
// day" (price history) — the inputs the engine needs to compute value and
// return, expressed in dollars/shares internally.

/**
 * DEPOSIT / WITHDRAWAL are external cash flows — money crossing the
 * boundary of the account. BUY / SELL are internal reallocations between
 * cash and securities and must never be treated as external flows.
 * DIVIDEND is investment return credited to cash. SPLIT is a prospective,
 * non-cash adjustment to share count.
 */
export type TransactionType =
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "BUY"
  | "SELL"
  | "DIVIDEND"
  | "SPLIT";

type TransactionBase = {
  /** Unique, stable identifier. Must be unique across the whole ledger. */
  id: string;
  /** ISO date "YYYY-MM-DD" the transaction is effective/settled. */
  date: string;
};

export type DepositTransaction = TransactionBase & {
  type: "DEPOSIT";
  /** Cash amount added to the account. Must be > 0. */
  amount: number;
};

export type WithdrawalTransaction = TransactionBase & {
  type: "WITHDRAWAL";
  /** Cash amount removed from the account. Must be > 0. */
  amount: number;
};

export type BuyTransaction = TransactionBase & {
  type: "BUY";
  ticker: string;
  /** Number of shares purchased. Must be > 0. */
  shares: number;
  /** Execution price per share. Must be > 0. */
  price: number;
  /** Optional trade fee, in dollars. Defaults to 0. */
  fee?: number;
};

export type SellTransaction = TransactionBase & {
  type: "SELL";
  ticker: string;
  /** Number of shares sold. Must be > 0. */
  shares: number;
  /** Execution price per share. Must be > 0. */
  price: number;
  /** Optional trade fee, in dollars. Defaults to 0. */
  fee?: number;
};

export type DividendTransaction = TransactionBase & {
  type: "DIVIDEND";
  ticker: string;
  /** Total cash credited. Must be > 0. */
  amount: number;
};

export type SplitTransaction = TransactionBase & {
  type: "SPLIT";
  ticker: string;
  /**
   * [newShares, oldShares] — e.g. [2, 1] for a 2-for-1 forward split,
   * [1, 2] for a 1-for-2 reverse split. Applied as shares *= n/d.
   */
  ratio: [number, number];
};

export type Transaction =
  | DepositTransaction
  | WithdrawalTransaction
  | BuyTransaction
  | SellTransaction
  | DividendTransaction
  | SplitTransaction;

/** A single day's closing price for one ticker. */
export type PricePoint = {
  date: string;
  price: number;
};

/**
 * ticker -> that ticker's daily price history, sorted ascending by date.
 *
 * IMPORTANT — split-adjustment contract: these prices must be RAW
 * (unadjusted for future splits), i.e. the actual price the security
 * traded at on that date. The ledger's own SPLIT transactions are the
 * single source of truth for reconciling share count across a split.
 *
 * If a future market-data provider only offers split-ADJUSTED closes
 * (a common default for "adjusted close" fields), the adapter must not
 * also feed this engine SPLIT transactions for the same event — that
 * would double-apply the split (shares multiplied by the engine *and*
 * historical price already retroactively divided by the provider).
 * Pick exactly one of: (a) raw prices + engine SPLIT transactions, or
 * (b) provider-adjusted prices + no engine SPLIT transaction for that
 * event. Never both for the same split.
 */
export type PriceHistory = Record<string, PricePoint[]>;
