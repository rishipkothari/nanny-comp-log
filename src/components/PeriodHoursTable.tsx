"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fmtDate, hrs, money } from "@/lib/calc";

export type PeriodDetail = {
  id: string; start: string; end: string;
  working: number; vacation: number; sick: number; holiday: number; total: number; ot: number;
  stipend: number; expenses: number;
  scheduled: { minutes: number; open: number } | null;
};

/** The pay-period hours table; tapping a row opens that period's totals in a popup. */
export default function PeriodHoursTable({ rows }: { rows: PeriodDetail[] }) {
  const [sel, setSel] = useState<PeriodDetail | null>(null);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (sel && !ref.current?.open) ref.current?.showModal();
  }, [sel]);

  return (
    <>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Pay period</th>
              <th>Working</th><th>Vacation</th><th>Sick</th><th>Holiday</th><th>Total</th><th>OT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.start} className="tap" onClick={() => setSel(r)}>
                <td>{fmtDate(r.start)} – {fmtDate(r.end)}</td>
                <td>{hrs(r.working)}</td><td>{hrs(r.vacation)}</td><td>{hrs(r.sick)}</td><td>{hrs(r.holiday)}</td>
                <td><b>{hrs(r.total)}</b></td>
                <td className={r.ot ? "ot" : ""}>{hrs(r.ot)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dialog
        ref={ref}
        className="detail"
        onClose={() => setSel(null)}
        // a click on the backdrop lands on the dialog element itself
        onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      >
        {sel && (
          <>
            <div className="head">
              <div>
                <div>{fmtDate(sel.start)} – {fmtDate(sel.end)}</div>
                <div className="muted small">Pay period {sel.id}</div>
              </div>
              <button type="button" className="small" onClick={() => ref.current?.close()} aria-label="Close">✕</button>
            </div>
            <div className="body">
              <div className="rowline">
                <span>Scheduled</span>
                <b>
                  {sel.scheduled ? `${hrs(sel.scheduled.minutes / 60)} h` : "—"}
                  {sel.scheduled && sel.scheduled.open > 0 && ` + ${sel.scheduled.open} day${sel.scheduled.open === 1 ? "" : "s"} without a total`}
                </b>
              </div>
              <div className="rowline"><span>Working</span><b>{hrs(sel.working)} h</b></div>
              <div className="rowline"><span>Vacation</span><b>{hrs(sel.vacation)} h</b></div>
              <div className="rowline"><span>Sick</span><b>{hrs(sel.sick)} h</b></div>
              <div className="rowline"><span>Holiday</span><b>{hrs(sel.holiday)} h</b></div>
              <div className="rowline total"><span>Total hours</span><b>{hrs(sel.total)} h</b></div>
              <div className="rowline"><span>Stipend</span><b>{money(sel.stipend)}</b></div>
              <div className="rowline"><span>Expenses</span><b>{money(sel.expenses)}</b></div>
            </div>
            <div className="links small">
              <Link href={`/timesheet?view=period&p=${sel.start}`}>Edit hours →</Link>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
