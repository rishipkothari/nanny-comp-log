"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addDays } from "@/lib/calc";

export type SeriesDef = { key: string; label: string; color: string; on: boolean };
export type Point = { date: string; label: string; values: Record<string, number> };

type Props = {
  unit: "hours" | "money";
  series: SeriesDef[];
  daily: Point[] | null; // null: only pay-period points exist (payments)
  periods: Point[];
  today: string;
};

const WINDOWS = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" },
  { key: "ytd", label: "YTD" },
  { key: "year", label: "Year" },
  { key: "all", label: "All" },
] as const;
type WindowKey = (typeof WINDOWS)[number]["key"];

function windowStart(w: WindowKey, today: string): string {
  switch (w) {
    case "week": return addDays(today, -6);
    case "month": return addDays(today, -29);
    case "quarter": return addDays(today, -90);
    case "ytd": return `${today.slice(0, 4)}-01-01`;
    case "year": return addDays(today, -364);
    default: return "0000-01-01";
  }
}

const short = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

export default function SummaryChart({ unit, series, daily, periods, today }: Props) {
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(series.map((s) => [s.key, s.on])));
  const [win, setWin] = useState<WindowKey>(unit === "hours" ? "quarter" : "year");

  const { data, grain } = useMemo(() => {
    const start = windowStart(win, today);
    const useDaily = daily !== null && (win === "week" || win === "month");
    if (useDaily) {
      const byDate = new Map(daily!.map((p) => [p.date, p]));
      const out: Point[] = [];
      for (let d = start; d <= today; d = addDays(d, 1)) {
        out.push(byDate.get(d) ?? { date: d, label: short(d), values: {} });
      }
      return { data: out, grain: "day" };
    }
    return { data: periods.filter((p) => p.date >= start && p.date <= addDays(today, 6)), grain: "pay period" };
  }, [win, today, daily, periods]);

  const rows = data.map((p) => ({ label: p.label, ...Object.fromEntries(series.map((s) => [s.key, Number((p.values[s.key] ?? 0).toFixed(2))])) }));
  const fmt = (v: unknown) => (unit === "money" ? `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `${Number(v).toFixed(1)}`);

  return (
    <div>
      <div className="chips">
        {WINDOWS.map((w) => (
          <button key={w.key} type="button" className={w.key === win ? "chip on" : "chip"} onClick={() => setWin(w.key)} aria-pressed={w.key === win}>
            {w.label}
          </button>
        ))}
      </div>
      <div className="checks">
        {series.map((s) => (
          <label key={s.key} className="check">
            <input type="checkbox" checked={on[s.key]} onChange={(e) => setOn((o) => ({ ...o, [s.key]: e.target.checked }))} />
            <span className="swatch" style={{ background: s.color }} />
            {s.label}
          </label>
        ))}
      </div>
      <div className="chartbox">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="currentColor" strokeOpacity={0.12} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} width={52} />
            <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", color: "var(--text)" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {series.filter((s) => on[s.key]).map((s) => (
              <Line key={s.key} type="linear" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={rows.length <= 40} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="muted small" style={{ marginTop: 6 }}>One point per {grain}.</div>
    </div>
  );
}
