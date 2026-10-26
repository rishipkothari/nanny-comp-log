"use client";

import { useState } from "react";
import { emptyDay, fmtDate, fmtDow, hrs, money, totalHours, type DayRow, type Settings } from "@/lib/calc";
import { useSaver } from "@/lib/useSaver";
import SaveStatus from "./SaveStatus";

type Props = { initial: DayRow[]; settings: Settings };

const clampInt = (v: string, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0;
};

export default function PeriodGrid({ initial, settings }: Props) {
  const [rows, setRows] = useState<DayRow[]>(initial);
  const { statuses, queue, flush } = useSaver<DayRow>("/api/day");

  const patch = (i: number, p: Partial<DayRow>) => {
    const next = { ...rows[i], ...p };
    setRows((r) => r.map((x, j) => (j === i ? next : x)));
    queue(next.date, next);
  };

  const time = (i: number, hKey: keyof DayRow, mKey: keyof DayRow, label: string) => {
    const r = rows[i];
    return (
      <>
        <td className="c">
          <input type="number" inputMode="numeric" min={0} max={99} value={r[hKey] as number} aria-label={`${fmtDate(r.date)} ${label} hours`}
            onFocus={(e) => e.target.select()} onChange={(e) => patch(i, { [hKey]: clampInt(e.target.value, 99) })} onBlur={() => flush(r.date)} />
        </td>
        <td className="c">
          <input type="number" inputMode="numeric" min={0} max={59} value={r[mKey] as number} aria-label={`${fmtDate(r.date)} ${label} minutes`}
            onFocus={(e) => e.target.select()} onChange={(e) => patch(i, { [mKey]: clampInt(e.target.value, 59) })} onBlur={() => flush(r.date)} />
        </td>
      </>
    );
  };

  const sum = (f: (d: DayRow) => number) => rows.reduce((a, d) => a + f(d), 0);
  const minutes = (hKey: keyof DayRow, mKey: keyof DayRow) => sum((d) => (d[hKey] as number) * 60 + (d[mKey] as number));
  const totals = {
    working: minutes("wh", "wm"),
    vacation: minutes("vh", "vm"),
    sick: minutes("sh", "sm"),
    holiday: minutes("hh", "hm"),
    stipend: sum((d) => d.stipend),
    expenses: sum((d) => d.expenses),
    total: sum(totalHours),
  };
  const hm = (mins: number) => `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;
  const ot = Math.max(totals.total - settings.otThreshold, 0);
  const pay = ot * settings.otRate + totals.stipend + totals.expenses;
  const anyStatus = rows.map((r) => statuses[r.date]);
  const overall = anyStatus.includes("error") ? "error" : anyStatus.includes("saving") ? "saving" : anyStatus.includes("saved") ? "saved" : "idle";

  return (
    <div>
      <div className="tablewrap grid">
        <table>
          <thead>
            <tr>
              <th rowSpan={2}>Day</th>
              <th colSpan={2} className="c">Working</th>
              <th colSpan={2} className="c">Vacation</th>
              <th colSpan={2} className="c">Sick</th>
              <th colSpan={2} className="c">Holiday</th>
              <th rowSpan={2}>Stipend</th>
              <th rowSpan={2}>Expenses</th>
              <th rowSpan={2}>Total hrs</th>
              <th rowSpan={2} className="l">Notes</th>
              <th rowSpan={2} />
              <th rowSpan={2} />
            </tr>
            <tr>
              {[0, 1, 2, 3].map((k) => (
                <FragmentHM key={k} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.date}>
                <td className="daycell">
                  <div>{fmtDow(r.date)}</div>
                  <div className="muted small">{fmtDate(r.date)}</div>
                </td>
                {time(i, "wh", "wm", "working")}
                {time(i, "vh", "vm", "vacation")}
                {time(i, "sh", "sm", "sick")}
                {time(i, "hh", "hm", "holiday")}
                <td className="c wide">
                  <input type="number" inputMode="decimal" step="0.01" min={0} value={r.stipend} aria-label={`${fmtDate(r.date)} stipend`}
                    onFocus={(e) => e.target.select()} onChange={(e) => patch(i, { stipend: Math.max(Number(e.target.value) || 0, 0) })} onBlur={() => flush(r.date)} />
                </td>
                <td className="c wide">
                  <input type="number" inputMode="decimal" step="0.01" min={0} value={r.expenses} aria-label={`${fmtDate(r.date)} expenses`}
                    onFocus={(e) => e.target.select()} onChange={(e) => patch(i, { expenses: Math.max(Number(e.target.value) || 0, 0) })} onBlur={() => flush(r.date)} />
                </td>
                <td className="calc">{hrs(totalHours(r))}</td>
                <td className="notes">
                  <input type="text" value={r.notes} aria-label={`${fmtDate(r.date)} notes`} onChange={(e) => patch(i, { notes: e.target.value })} onBlur={() => flush(r.date)} />
                </td>
                <td className="st">
                  <SaveStatus status={statuses[r.date]} compact />
                </td>
                <td className="clr">
                  <button
                    type="button"
                    className="danger small"
                    aria-label={`Clear ${fmtDow(r.date)} ${fmtDate(r.date)}`}
                    onClick={() => {
                      if (!window.confirm(`Clear everything entered for ${fmtDow(r.date)} ${fmtDate(r.date)}?`)) return;
                      patch(i, emptyDay(r.date));
                      flush(r.date);
                    }}
                  >
                    Clear
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td colSpan={2} className="c">{hm(totals.working)}</td>
              <td colSpan={2} className="c">{hm(totals.vacation)}</td>
              <td colSpan={2} className="c">{hm(totals.sick)}</td>
              <td colSpan={2} className="c">{hm(totals.holiday)}</td>
              <td>{money(totals.stipend)}</td>
              <td>{money(totals.expenses)}</td>
              <td className="calc">{hrs(totals.total)}</td>
              <td />
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="sumline">
        <div className="rowline"><span>Overtime (over {settings.otThreshold} h)</span><b>{hrs(ot)} h</b></div>
        <div className="rowline"><span>Personal pay (OT × {money(settings.otRate)} + stipend + expenses)</span><b>{money(pay)}</b></div>
      </div>
      <div className="savebar"><SaveStatus status={overall} /></div>
    </div>
  );
}

function FragmentHM() {
  return (
    <>
      <th className="c sub">h</th>
      <th className="c sub">m</th>
    </>
  );
}
