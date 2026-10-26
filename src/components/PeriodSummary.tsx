import Link from "next/link";
import { fmtDate, fmtDateTime, hrs, money, type Period, type PeriodStatus } from "@/lib/calc";
import StatusBadges from "./StatusBadges";

/** Compact read-only view of one pay period, linking to its entry in the payment log. */
export default function PeriodSummary({ period, status }: { period: Period; status: PeriodStatus }) {
  const at = period.payment?.approved_at;
  return (
    <Link href={`/payments?p=${period.start}#p-${period.start}`} className="pcard">
      <div className="top">
        <div>
          <div>{fmtDate(period.start)} – {fmtDate(period.end)}</div>
          <div className="muted small">{hrs(period.total)} h · personal due {money(period.personalDue)}</div>
        </div>
        <StatusBadges status={status} />
      </div>
      <div className="vals">
        <div><span>Homepay net</span>{money(period.homepayNet)}</div>
        <div><span>Personal paid</span>{money(period.personalPaid)}</div>
        <div><span>Total</span><b>{money(period.totalPaid)}</b></div>
      </div>
      <div className="muted small" style={{ marginTop: 8 }}>
        Hours approved: <b style={{ color: period.approved ? "var(--ok)" : "var(--bad)" }}>{period.approved ? "Yes" : "No"}</b>
        {period.approved && (at ? ` · ${fmtDateTime(at)}` : " · imported")}
      </div>
    </Link>
  );
}
