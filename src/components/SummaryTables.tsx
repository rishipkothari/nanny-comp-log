import Link from "next/link";
import StatusBadges from "./StatusBadges";
import { fmtDate, hrs, money, type Group, type HoursRow, type PaymentsRow } from "@/lib/calc";

/** A row whose cells all link to `href`, so the whole row is clickable. */
function Cells({ href, cells }: { href?: string; cells: [React.ReactNode, string?][] }) {
  return cells.map(([content, className], i) => (
    <td key={i} className={className}>
      {href ? <Link href={href}>{content}</Link> : content}
    </td>
  ));
}

export function HoursTable({ rows, group, href }: { rows: HoursRow[]; group: Group; href?: (r: HoursRow) => string }) {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>{group === "period" ? "Pay period" : group === "month" ? "Month" : "Year"}</th>
            <th>Working</th><th>Vacation</th><th>Sick</th><th>Holiday</th><th>Total</th>
            {group === "period" && <th>OT</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={href ? "rowlink" : undefined}>
              <Cells
                href={href?.(r)}
                cells={[
                  [r.label], [hrs(r.working)], [hrs(r.vacation)], [hrs(r.sick)], [hrs(r.holiday)], [<b key="t">{hrs(r.total)}</b>],
                  ...(group === "period" ? [[hrs(r.ot ?? 0), r.ot ? "ot" : ""] as [string, string]] : []),
                ]}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const day = (d: string | null) => (d ? fmtDate(d) : "—");

/** Pay periods show every payment detail and status badges; month and year rollups show the sums. */
export function PaymentsTable({ rows, href }: { rows: PaymentsRow[]; href?: (r: PaymentsRow) => string }) {
  const detail = rows.some((r) => r.detail);
  return (
    <div className="tablewrap">
      <table className="paytable">
        <thead>
          <tr>
            <th>Period</th>
            {detail && <th className="l">Status</th>}
            <th>Hours</th><th>Personal due</th><th>Personal paid</th>
            {detail && <><th>Paid on</th><th className="l">Route</th></>}
            <th>Owed</th><th>Homepay earnings</th><th>Homepay net</th>
            {detail && <th>Homepay on</th>}
            <th>Total paid</th>
            {detail && <th>Notes</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const d = r.detail;
            const cells: [React.ReactNode, string?][] = [[r.label]];
            if (detail) cells.push([d ? <StatusBadges key="s" status={d.status} /> : null, "status l"]);
            cells.push([hrs(r.hours)], [money(r.due)], [money(r.paid)]);
            if (detail) cells.push([day(d?.personalDate ?? null)], [d?.route || "—", "l"]);
            cells.push([money(r.owed), Math.abs(r.owed) >= 0.005 ? "ot" : ""], [money(r.earnings)], [money(r.homepay)]);
            if (detail) cells.push([day(d?.homepayDate ?? null)]);
            cells.push([<b key="t">{money(r.totalPaid)}</b>]);
            if (detail) cells.push([d?.notes || "—", "notes"]);
            return (
              <tr key={r.key} className={href ? "rowlink" : undefined}>
                <Cells href={href?.(r)} cells={cells} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
