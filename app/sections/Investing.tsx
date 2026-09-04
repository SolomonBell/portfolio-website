"use client";

import { useMemo, useState } from "react";
import HoldingsList from "../components/ui/HoldingsList";
import PerformanceChart from "../components/ui/PerformanceChart";
import {
  RANGE_OPTIONS,
  SERIES_META,
  formatPercent,
  formatPercentagePoints,
  getPerformanceForRange,
  mockPortfolio,
  type RangeKey,
} from "../lib/investing";

export default function Investing() {
  const [range, setRange] = useState<RangeKey>("1Y");

  const data = useMemo(
    () => getPerformanceForRange(mockPortfolio, range),
    [range]
  );

  const latest = data[data.length - 1];
  const vsSpy = latest ? latest.portfolio - latest.spy : 0;

  return (
    <section
      id="investing"
      className="mx-auto max-w-5xl px-6 py-16 border-t border-white/10"
    >
      <h2 className="text-2xl font-semibold tracking-tight text-center">
        Draft Investment Portfolio
      </h2>

      <div className="mt-10 rounded-2xl border border-white/10 bg-white/3 p-5 sm:p-6">
        <h3 className="text-center text-lg font-medium text-white">
          Draft Placeholder Portfolio
        </h3>

        <div className="mt-4 flex gap-4 overflow-x-auto border-b border-white/10 sm:gap-6">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={`shrink-0 border-b-2 pb-2 text-sm font-medium transition-colors ${
                range === r
                  ? "border-white text-white"
                  : "border-transparent text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <PerformanceChart data={data} range={range} />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4 border-t border-white/10 pt-5 text-center">
          {SERIES_META.map((s) => (
            <div key={s.key}>
              <p className="flex items-center justify-center gap-1.5 text-xs text-neutral-400">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                {s.label}
              </p>
              <p
                className={`mt-1 tabular-nums ${
                  s.key === "portfolio"
                    ? "text-xl font-semibold text-white"
                    : "text-lg text-neutral-200"
                }`}
              >
                {formatPercent(latest?.[s.key] ?? 0)}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-2 text-center text-xs text-neutral-500">
          vs. S&P 500 {formatPercentagePoints(vsSpy)}
        </p>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-neutral-500">
          <span>Placeholder data — for demonstration only</span>
          <span>·</span>
          <DisclaimerControl />
        </div>
      </div>

      <div className="mt-10">
        <h3 className="text-sm font-medium text-neutral-400 tracking-wide uppercase">
          Holdings
        </h3>
        <div className="mt-4">
          <HoldingsList
            holdings={mockPortfolio.holdings}
            range={range}
            asOfDate={mockPortfolio.asOfDate}
          />
        </div>
      </div>

      <div className="mt-10 space-y-4 text-neutral-300 leading-relaxed">
        <p className="indent-8">
          I actively manage a personal equity portfolio with the goal of outperforming
          the broader market over the long term. The chart above tracks my
          portfolio&apos;s performance against major market benchmarks across different
          time horizons.
        </p>
        <p className="indent-8">
          My investment approach focuses on identifying companies that I believe have
          the potential to outperform the market over the long term. I look for
          durable competitive advantages, strong opportunities for sustained growth,
          and businesses whose long-term prospects I believe are not fully reflected
          in their current valuation. Sustained market outperformance is a difficult
          benchmark: according to S&P Dow Jones Indices, just{" "}
          <a
            href="https://www.spglobal.com/spdji/en/documents/spiva/spiva-us-year-end-2025.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white underline underline-offset-4 decoration-white/30 hover:decoration-white/70 transition"
          >
            14.41%
          </a>{" "}
          of actively managed U.S. large-cap funds beat the S&P 500 over the 10
          years ending in 2025, and only{" "}
          <a
            href="https://www.spglobal.com/spdji/en/documents/spiva/spiva-us-year-end-2025.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white underline underline-offset-4 decoration-white/30 hover:decoration-white/70 transition"
          >
            10.07%
          </a>{" "}
          did so over 15 years. My goal is to achieve that kind of sustained
          outperformance over the long term.
        </p>
      </div>
    </section>
  );
}

function DisclaimerControl() {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="underline decoration-dotted underline-offset-2 hover:text-neutral-300 transition-colors"
      >
        Disclaimer
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close disclaimer"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="dialog"
            aria-label="Disclaimer"
            className="absolute bottom-full right-0 z-50 mb-2 w-64 rounded-lg border border-white/10 bg-neutral-900 p-3 text-left text-xs leading-relaxed text-neutral-300 shadow-xl"
          >
            Placeholder portfolio — holdings and performance shown are illustrative
            sample data while the live portfolio is being established. This is not
            investment advice and does not reflect actual results.
          </div>
        </>
      )}
    </span>
  );
}
