import { formatPercent, type Holding } from "../../lib/investing";

export default function HoldingsList({ holdings }: { holdings: Holding[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {holdings.map((h) => {
        const positive = h.totalReturnPct >= 0;
        return (
          <div
            key={h.ticker}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-white">{h.ticker}</span>
              <span
                className={`text-sm tabular-nums ${
                  positive ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {formatPercent(h.totalReturnPct)}
              </span>
            </div>
            <p className="mt-0.5 truncate text-sm text-neutral-400">{h.name}</p>
            <p className="mt-2 text-xs text-neutral-500">
              {h.allocationPct.toFixed(0)}% of portfolio
            </p>
          </div>
        );
      })}
    </div>
  );
}
