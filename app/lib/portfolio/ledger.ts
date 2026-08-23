// Ledger validation and the shared cash/shares reducer.
//
// The ledger is treated as an immutable record of what actually happened:
// nothing in this module ever rewrites a transaction (a stock split does
// NOT rewrite a historical BUY's share count — see SPLIT handling below).

import type { Transaction, TransactionType } from "./types";

const EPS = 1e-6;

/**
 * Same-date tie-break order. Cash-generating events resolve before
 * cash-consuming ones so a same-day "deposit then buy" or "sell then buy"
 * sequence — the normal way a person would actually enter same-day
 * trades — settles correctly regardless of the order rows happen to
 * appear in the source file. WITHDRAWAL is last so it never competes
 * with the same day's inflows for solvency.
 */
const TYPE_PRIORITY: Record<TransactionType, number> = {
  DEPOSIT: 0,
  DIVIDEND: 1,
  SELL: 2,
  BUY: 3,
  SPLIT: 4,
  WITHDRAWAL: 5,
};

export class LedgerValidationError extends Error {}

/** Running cash + per-ticker share balances as of a point in the ledger. */
export type LedgerState = {
  cash: number;
  shares: Record<string, number>;
};

export function initialLedgerState(): LedgerState {
  return { cash: 0, shares: {} };
}

/**
 * Applies one transaction to a ledger state, returning a new state.
 * Throws `LedgerValidationError` on any impossible state (overdraft,
 * overselling, etc.) — this function never silently clamps or corrects
 * invalid financial data.
 */
export function applyTransaction(state: LedgerState, t: Transaction): LedgerState {
  const shares = { ...state.shares };

  switch (t.type) {
    case "DEPOSIT": {
      assertPositive(t.amount, `DEPOSIT amount on ${t.date}`);
      return { cash: state.cash + t.amount, shares };
    }

    case "WITHDRAWAL": {
      assertPositive(t.amount, `WITHDRAWAL amount on ${t.date}`);
      if (t.amount > state.cash + EPS) {
        throw new LedgerValidationError(
          `WITHDRAWAL of ${t.amount} on ${t.date} exceeds available cash (${state.cash})`
        );
      }
      return { cash: state.cash - t.amount, shares };
    }

    case "BUY": {
      assertPositive(t.shares, `BUY shares on ${t.date}`);
      assertPositive(t.price, `BUY price on ${t.date}`);
      const fee = t.fee ?? 0;
      if (fee < 0) throw new LedgerValidationError(`BUY fee on ${t.date} cannot be negative`);
      const cost = t.shares * t.price + fee;
      if (cost > state.cash + EPS) {
        throw new LedgerValidationError(
          `BUY of ${t.ticker} on ${t.date} costs ${cost} but only ${state.cash} cash is available`
        );
      }
      shares[t.ticker] = (shares[t.ticker] ?? 0) + t.shares;
      return { cash: state.cash - cost, shares };
    }

    case "SELL": {
      assertPositive(t.shares, `SELL shares on ${t.date}`);
      assertPositive(t.price, `SELL price on ${t.date}`);
      const fee = t.fee ?? 0;
      if (fee < 0) throw new LedgerValidationError(`SELL fee on ${t.date} cannot be negative`);
      const held = shares[t.ticker] ?? 0;
      if (t.shares > held + EPS) {
        throw new LedgerValidationError(
          `SELL of ${t.shares} ${t.ticker} on ${t.date} exceeds held shares (${held})`
        );
      }
      shares[t.ticker] = held - t.shares;
      return { cash: state.cash + t.shares * t.price - fee, shares };
    }

    case "DIVIDEND": {
      assertPositive(t.amount, `DIVIDEND amount on ${t.date}`);
      return { cash: state.cash + t.amount, shares };
    }

    case "SPLIT": {
      const [n, d] = t.ratio;
      if (!(n > 0) || !(d > 0)) {
        throw new LedgerValidationError(`SPLIT ratio on ${t.date} must have positive terms`);
      }
      const held = shares[t.ticker] ?? 0;
      if (held <= EPS) {
        throw new LedgerValidationError(
          `SPLIT of ${t.ticker} on ${t.date} has no shares held to split`
        );
      }
      shares[t.ticker] = held * (n / d);
      return { cash: state.cash, shares };
    }
  }
}

function assertPositive(value: number, label: string) {
  if (!(value > 0)) {
    throw new LedgerValidationError(`${label} must be a positive number, got ${value}`);
  }
}

/**
 * Validates and returns a chronologically sorted copy of the ledger.
 *
 * Sorting, not rejection, is the deterministic behavior for out-of-order
 * input: transactions are sorted by date ascending, then by the
 * `TYPE_PRIORITY` tie-break above for same-date rows, so a hand-edited
 * ledger file doesn't need to be kept in perfect order to be valid.
 *
 * Throws on: duplicate ids, invalid field values, and any impossible
 * financial state (overdraft, overselling, splitting a position you
 * don't hold, a ledger that doesn't begin with a DEPOSIT).
 */
export function validateAndSortLedger(transactions: Transaction[]): Transaction[] {
  const seenIds = new Set<string>();
  for (const t of transactions) {
    if (seenIds.has(t.id)) {
      throw new LedgerValidationError(`Duplicate transaction id: ${t.id}`);
    }
    seenIds.add(t.id);
  }

  const sorted = [...transactions].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type];
  });

  if (sorted.length > 0 && sorted[0].type !== "DEPOSIT") {
    throw new LedgerValidationError(
      "Ledger must begin with a DEPOSIT — portfolio inception is defined as the first deposit date"
    );
  }

  let state = initialLedgerState();
  for (const t of sorted) {
    state = applyTransaction(state, t);
  }

  return sorted;
}

/** The first (chronological) DEPOSIT date — portfolio inception. */
export function getInceptionDate(sortedTransactions: Transaction[]): string {
  const firstDeposit = sortedTransactions.find((t) => t.type === "DEPOSIT");
  if (!firstDeposit) {
    throw new LedgerValidationError("Ledger contains no DEPOSIT transaction");
  }
  return firstDeposit.date;
}
