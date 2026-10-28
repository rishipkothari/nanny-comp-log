import Link from "next/link";
import { OwedCell, PaymentTableRow } from "./PaymentCard";
import { DetailTable } from "./PeriodDetail";
import { hrs, money, type Group, type HoursRow, type PaymentsRow, type Period, type PeriodDetail } from "@/lib/calc";

/** Hours per pay period, month or year. A row links to `href`, or opens its period's popup from `details`. */
export function HoursTable({ rows, group, href, details }: {
  rows: HoursRow[]; group: Group; href?: (r: HoursRow) => string; details?: Map<string, PeriodDetail>;
}) {
  const head = (
    <tr>
      <th>{group === "period" ? "Pay period" : group === "month" ? "Month" : "Year"}</th>
      <th>Working</th><th>Vacation</th><th>Sick</th><th>Holiday</th><th>Total</th>
      {group === "period" && <th>OT</th>}
    </tr>
  );
  const cells = (r: HoursRow) => {
    const link = (c: React.ReactNode) => (href ? <Link href={href(r)}>{c}</Link> : c);
    return (
      <>
        <td>{link(r.label)}</td>
        <td>{link(hrs(r.working))}</td><td>{link(hrs(r.vacation))}</td><td>{link(hrs(r.sick))}</td><td>{link(hrs(r.holiday))}</td>
        <td>{link(<b>{hrs(r.total)}</b>)}</td>
        {group === "period" && <td className={r.ot ? "ot" : ""}>{link(hrs(r.ot ?? 0))}</td>}
      </>
    );
  };
  if (href) {
    return (
      <div className="tablewrap">
        <table>
          <thead>{head}</thead>
          <tbody>{rows.map((r) => <tr key={r.key} className="rowlink">{cells(r)}</tr>)}</tbody>
        </table>
      </div>
    );
  }
  return <DetailTable head={head} rows={rows.map((r) => ({ key: r.key, detail: details?.get(r.key), cells: cells(r) }))} />;
}

/** Every payment detail per pay period, with status badges; a row opens the payment popup (editable in admin mode). */
export function PaymentLog({ periods, editable, today, venmoHandle }: { periods: Period[]; editable: boolean; today: string; venmoHandle: string }) {
  return (
    <div className="tablewrap paylog">
      <table>
        <thead>
          <tr>
            <th>Pay period</th><th>Status</th><th>Approved</th><th>Hours</th>
            <th>Regular due</th><th>Regular paid</th><th>Regular date</th><th>Regular owed</th>
            <th>Personal due</th><th>Personal paid</th><th>Personal date</th><th>Route</th><th>Personal owed</th>
            <th>Total owed</th><th>Total paid</th><th className="l">Notes</th>
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => (
            <PaymentTableRow key={`${p.start}-${editable}`} period={p} editable={editable} today={today} venmoHandle={venmoHandle} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Payment sums per month or year (pay periods use PaymentLog). */
export function PaymentsTable({ rows }: { rows: PaymentsRow[] }) {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Period</th><th>Hours</th><th>Regular due</th><th>Regular paid</th><th>Regular owed</th>
            <th>Personal due</th><th>Personal paid</th><th>Personal owed</th><th>Total owed</th><th>Total paid</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td><td>{hrs(r.hours)}</td>
              <td>{money(r.regularDue)}</td><td>{money(r.regularPaid)}</td><OwedCell n={r.regularOwed} />
              <td>{money(r.due)}</td><td>{money(r.paid)}</td><OwedCell n={r.owed} /><OwedCell n={r.totalOwed} />
              <td><b>{money(r.totalPaid)}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
