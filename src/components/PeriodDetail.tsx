"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { fmtDate, fmtDateTime, hrs, money, type PeriodDetail } from "@/lib/calc";
import Modal from "./Modal";
import StatusBadges from "./StatusBadges";

/** A pay period's hours and payments in one popup. Open while `detail` is set; closing calls onClose. */
export function PeriodDetailDialog({ detail, onClose }: { detail: PeriodDetail | null; onClose: () => void }) {
  return (
    <Modal open={!!detail} onClose={onClose}>
      {detail && <Body d={detail} close={onClose} />}
    </Modal>
  );
}

/** A "Detail" link for cards: opens the pay period popup. */
export function DetailButton({ detail }: { detail: PeriodDetail }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="linkish" onClick={() => setOpen(true)}>Detail →</button>
      <PeriodDetailDialog detail={open ? detail : null} onClose={() => setOpen(false)} />
    </>
  );
}

export type TableRow = { key: string; cells: ReactNode; detail?: PeriodDetail };

/** A summary table whose rows with a detail open the pay period popup when tapped. */
export function DetailTable({ head, rows }: { head: ReactNode; rows: TableRow[] }) {
  const [sel, setSel] = useState<PeriodDetail | null>(null);
  return (
    <>
      <div className="tablewrap">
        <table>
          <thead>{head}</thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={r.detail ? "tap" : undefined} onClick={r.detail ? () => setSel(r.detail!) : undefined}>
                {r.cells}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PeriodDetailDialog detail={sel} onClose={() => setSel(null)} />
    </>
  );
}

function Body({ d, close }: { d: PeriodDetail; close: () => void }) {
  const p = d.period;
  const pay = p.payment;
  const s = d.scheduled;
  const line = (label: string, value: ReactNode, cls?: string) => (
    <div className={cls ? `rowline ${cls}` : "rowline"}><span>{label}</span><b>{value}</b></div>
  );
  const owed = d.status.outstanding;
  const regularOwed = p.regularDue - p.regularPaid;

  return (
    <>
      <div className="head">
        <div>
          <div>{fmtDate(p.start)} – {fmtDate(p.end)}</div>
          <div className="muted small">Pay period {p.id}</div>
        </div>
        <div className="headright">
          <StatusBadges status={d.status} />
          <button type="button" className="small" onClick={close} aria-label="Close">✕</button>
        </div>
      </div>

      <div className="body">
        <h3>Hours</h3>
        {line("Scheduled", s ? `${hrs(s.minutes / 60)} h${s.open > 0 ? ` + ${s.open} day${s.open === 1 ? "" : "s"} without a total` : ""}` : "—")}
        {line("Working", `${hrs(p.worked)} h`)}
        {line("Vacation", `${hrs(p.vacation)} h`)}
        {line("Sick", `${hrs(p.sick)} h`)}
        {line("Holiday", `${hrs(p.holiday)} h`)}
        {line("Total hours", `${hrs(p.total)} h`, "total")}
        {line(`Overtime (over ${d.otThreshold} h)`, `${hrs(p.ot)} h`)}
        {line("Hours approved", pay?.approved ? `Yes${pay.approved_at ? ` · ${fmtDateTime(pay.approved_at)}` : ""}` : "No")}

        <h3>Personal pay</h3>
        {line(`Overtime pay (${hrs(p.ot)} h × ${money(d.otRate)})`, money(p.ot * d.otRate))}
        {line("Stipend", money(p.stipend))}
        {line("Expenses", money(p.expenses))}
        {line("Personal due", money(p.personalDue), "total")}
        {line("Personal paid", pay?.personal_paid != null ? money(pay.personal_paid) : "—")}
        {line("Paid date", pay?.personal_date ? fmtDate(pay.personal_date) : "—")}
        {line("Route", pay?.route || "—")}
        {Math.abs(owed) >= 0.005 && line(owed > 0 ? "Still owed" : "Overpaid", money(Math.abs(owed)), "warn")}

        <h3>Regular pay</h3>
        {line("Regular due", pay?.regular_due != null ? money(pay.regular_due) : "—")}
        {line("Regular paid", pay?.regular_paid != null ? money(pay.regular_paid) : "—")}
        {line("Paid date", pay?.regular_date ? fmtDate(pay.regular_date) : "—")}
        {Math.abs(regularOwed) >= 0.005 && line(regularOwed > 0 ? "Still owed" : "Overpaid", money(Math.abs(regularOwed)), "warn")}

        {line("Total paid", money(p.totalPaid), "total")}
        {pay?.notes && line("Notes", pay.notes)}
      </div>

      <div className="links small">
        <Link href={`/timesheet?view=period&p=${p.start}`}>Edit hours →</Link>
        <Link href={`/payments?p=${p.start}#p-${p.start}`}>Payment →</Link>
      </div>
    </>
  );
}
