import { describe, expect, it } from "vitest";
import { LedgerValidationError, getInceptionDate, validateAndSortLedger } from "./ledger";
import type { Transaction } from "./types";

describe("validateAndSortLedger — validation rules", () => {
  it("rejects a ledger that doesn't begin with a DEPOSIT", () => {
    const txns: Transaction[] = [
      { id: "buy1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 1, price: 100 },
    ];
    expect(() => validateAndSortLedger(txns)).toThrow(LedgerValidationError);
  });

  it("rejects duplicate transaction ids", () => {
    const txns: Transaction[] = [
      { id: "dup", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
      { id: "dup", date: "2026-01-02", type: "DEPOSIT", amount: 500 },
    ];
    expect(() => validateAndSortLedger(txns)).toThrow(/duplicate/i);
  });

  it("rejects SELL for more shares than currently held", () => {
    const txns: Transaction[] = [
      { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 10, price: 100 },
      { id: "s1", date: "2026-01-02", type: "SELL", ticker: "XYZ", shares: 11, price: 100 },
    ];
    expect(() => validateAndSortLedger(txns)).toThrow(/exceeds held shares/i);
  });

  it("rejects WITHDRAWAL for more cash than available", () => {
    const txns: Transaction[] = [
      { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
      { id: "w1", date: "2026-01-02", type: "WITHDRAWAL", amount: 1001 },
    ];
    expect(() => validateAndSortLedger(txns)).toThrow(/exceeds available cash/i);
  });

  it("rejects BUY that requires more cash than available", () => {
    const txns: Transaction[] = [
      { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-01-02", type: "BUY", ticker: "XYZ", shares: 11, price: 100 },
    ];
    expect(() => validateAndSortLedger(txns)).toThrow(/only .* cash is available/i);
  });

  it("rejects zero/negative share quantities on BUY", () => {
    const txns: Transaction[] = [
      { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-01-02", type: "BUY", ticker: "XYZ", shares: -1, price: 100 },
    ];
    expect(() => validateAndSortLedger(txns)).toThrow(LedgerValidationError);
  });

  it("rejects zero/negative prices on BUY", () => {
    const txns: Transaction[] = [
      { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-01-02", type: "BUY", ticker: "XYZ", shares: 1, price: 0 },
    ];
    expect(() => validateAndSortLedger(txns)).toThrow(LedgerValidationError);
  });

  it("rejects invalid (non-positive) split ratios", () => {
    const txns: Transaction[] = [
      { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 10, price: 100 },
      { id: "sp1", date: "2026-01-02", type: "SPLIT", ticker: "XYZ", ratio: [0, 1] },
    ];
    expect(() => validateAndSortLedger(txns)).toThrow(LedgerValidationError);
  });

  it("rejects splitting a ticker with no shares held", () => {
    const txns: Transaction[] = [
      { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
      { id: "sp1", date: "2026-01-02", type: "SPLIT", ticker: "XYZ", ratio: [2, 1] },
    ];
    expect(() => validateAndSortLedger(txns)).toThrow(/no shares held to split/i);
  });

  it("sorts out-of-order input deterministically by date", () => {
    const txns: Transaction[] = [
      { id: "b1", date: "2026-01-03", type: "BUY", ticker: "XYZ", shares: 1, price: 100 },
      { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
      { id: "d2", date: "2026-01-02", type: "DEPOSIT", amount: 500 },
    ];
    const sorted = validateAndSortLedger(txns);
    expect(sorted.map((t) => t.id)).toEqual(["d1", "d2", "b1"]);
  });

  it("resolves same-day DEPOSIT-then-BUY correctly regardless of input order", () => {
    const txns: Transaction[] = [
      // BUY listed before its funding DEPOSIT in the source array
      { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 10, price: 100 },
      { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
    ];
    const sorted = validateAndSortLedger(txns);
    expect(sorted.map((t) => t.id)).toEqual(["d1", "b1"]);
  });

  it("accepts a valid ledger and reports the correct inception date", () => {
    const txns: Transaction[] = [
      { id: "d1", date: "2026-01-01", type: "DEPOSIT", amount: 1000 },
      { id: "b1", date: "2026-01-01", type: "BUY", ticker: "XYZ", shares: 10, price: 100 },
    ];
    const sorted = validateAndSortLedger(txns);
    expect(getInceptionDate(sorted)).toBe("2026-01-01");
  });
});
