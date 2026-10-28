import Link from "next/link";
import { hrs, money, type Group, type HoursRow, type PaymentsRow } from "@/lib/calc";

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

export function PaymentsTable({ rows, href }: { rows: PaymentsRow[]; href?: (r: PaymentsRow) => string }) {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Period</th><th>Homepay net</th><th>Personal due</th><th>Personal paid</th><th>Owed</th><th>Total paid</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={href ? "rowlink" : undefined}>
              <Cells
                href={href?.(r)}
                cells={[
                  [r.label], [money(r.homepay)], [money(r.due)], [money(r.paid)],
                  [money(r.owed), Math.abs(r.owed) >= 0.005 ? "ot" : ""], [<b key="t">{money(r.totalPaid)}</b>],
                ]}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
