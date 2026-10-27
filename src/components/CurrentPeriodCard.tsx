import Link from "next/link";
import { addDays, fmtDate, hrs, money, type Period, type PeriodStatus } from "@/lib/calc";
import StatusBadges from "./StatusBadges";

type Planned = { minutes: number; open: number } | null;

/** The current pay period in one card: hours, overtime, personal pay due and the scheduled total. */
export default function CurrentPeriodCard({ start, period, status, planned, admin }: {
  start: string; period: Period | undefined; status: PeriodStatus | undefined; planned: Planned; admin: boolean;
}) {
  return (
    <div className="pcard">
      <div className="top">
        <div>
          <div>{fmtDate(start)} – {fmtDate(addDays(start, 6))}</div>
          <div className="muted small">{period ? `Pay period ${period.id}` : "Nothing recorded yet"}</div>
        </div>
        {status && <StatusBadges status={status} />}
      </div>
      <div className="vals four">
        <div><span>Hours so far</span>{hrs(period?.total ?? 0)}</div>
        <div><span>Overtime</span>{hrs(period?.ot ?? 0)}</div>
        <div><span>Personal due</span><b>{money(period?.personalDue ?? 0)}</b></div>
        <div>
          <span>Scheduled</span>
          {planned ? hrs(planned.minutes / 60) : "—"}
          {planned && planned.open > 0 && <span>+ {planned.open} day{planned.open === 1 ? "" : "s"} without a total</span>}
        </div>
      </div>
      <div className="small links">
        <Link href={`/timesheet?view=period&p=${start}`}>Edit hours →</Link>
        <Link href="/schedule">{planned ? "Schedule →" : admin ? "Deduce schedule →" : "Schedule →"}</Link>
        {period && <Link href={`/payments?p=${start}#p-${start}`}>Payment →</Link>}
      </div>
    </div>
  );
}
