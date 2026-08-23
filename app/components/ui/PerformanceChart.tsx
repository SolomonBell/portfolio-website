"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  SERIES_META,
  formatAxisDate,
  formatPercent,
  formatTooltipDate,
  getHourTicks,
  getMonthTicks,
  getTradingDayTicks,
  getYearTicks,
  type PerformancePoint,
  type RangeKey,
} from "../../lib/investing";

function ChartTooltip({
  active,
  payload,
  label,
  range,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: string;
  range: RangeKey;
}) {
  if (!active || !payload?.length || !label) return null;

  const byKey = Object.fromEntries(payload.map((p) => [p.dataKey, p.value]));

  // Highest return first, lowest last, for this specific hovered date.
  // Array.prototype.sort is stable, so equal values keep SERIES_META's
  // original order (Placeholder Portfolio, S&P 500, NASDAQ-100) as the
  // deterministic tie-break, with no extra logic needed.
  const sortedSeries = [...SERIES_META].sort(
    (a, b) => (byKey[b.key] ?? 0) - (byKey[a.key] ?? 0)
  );

  return (
    <div className="rounded-xl border border-white/10 bg-neutral-900/95 px-4 py-3 text-sm shadow-lg backdrop-blur">
      <p className="text-xs text-neutral-400">{formatTooltipDate(label, range)}</p>
      <div className="mt-2 space-y-1">
        {sortedSeries.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-neutral-300">{s.label}</span>
            <span className="ml-auto font-medium text-white tabular-nums">
              {formatPercent(byKey[s.key] ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PerformanceChart({
  data,
  range,
}: {
  data: PerformancePoint[];
  range: RangeKey;
}) {
  // Each range has a fixed label unit; candidates come from that unit's
  // real calendar boundaries (hour / trading day / month / year) so no
  // two ticks can ever collapse to the same label. The axis still thins
  // this list for width/collisions via `interval` below.
  const explicitTicks = useMemo(() => {
    if (range === "1D") return getHourTicks(data);
    if (range === "5D" || range === "1M") return getTradingDayTicks(data);
    if (range === "6M" || range === "YTD" || range === "1Y") return getMonthTicks(data);
    return getYearTicks(data); // "5Y" | "Max"
  }, [data, range]);

  return (
    <div className="h-80 w-full sm:h-96 md:h-105">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid
            stroke="rgba(255,255,255,0.06)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => formatAxisDate(d, range)}
            tick={{ fill: "#a3a3a3", fontSize: 12 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickLine={false}
            ticks={explicitTicks}
            interval="equidistantPreserveStart"
            minTickGap={40}
          />
          <YAxis
            tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`}
            tick={{ fill: "#a3a3a3", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={48}
            domain={["auto", "auto"]}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
          <Tooltip
            content={<ChartTooltip range={range} />}
            cursor={{ stroke: "rgba(255,255,255,0.2)" }}
            wrapperStyle={{ outline: "none" }}
            isAnimationActive={false}
          />
          {SERIES_META.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={s.width}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
