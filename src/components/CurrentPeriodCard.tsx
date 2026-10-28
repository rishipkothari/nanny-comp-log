import Link from "next/link";
import { addDays, fmtDate, hrs, money, type Period, type PeriodDetail, type PeriodStatus } from "@/lib/calc";
import { DetailButton } from "./PeriodDetail";
import StatusBadges from "./StatusBadges";

type Planned = { minutes: number; open: number } | null;

/** The current pay period in one card: hours, the scheduled total, expenses and stipend. */
export default function CurrentPeriodCard({ start, period, status, planned, admin, detail }: {
  start: string; period: Period | undefined; status: PeriodStatus | undefined; planned: Planned; admin: boolean; detail: PeriodDetail | undefined;
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
        <div>
          <span>Scheduled</span>
          {planned ? hrs(planned.minutes / 60) : "—"}
          {planned && planned.open > 0 && <span>+ {planned.open} day{planned.open === 1 ? "" : "s"} without a total</span>}
        </div>
        <div><span>Expenses</span>{money(period?.expenses ?? 0)}</div>
        <div><span>Stipend</span>{money(period?.stipend ?? 0)}</div>
      </div>
      <div className="small links">
        {detail && <DetailButton detail={detail} />}
        <Link href={`/timesheet?view=period&p=${start}`}>Edit hours →</Link>
        <Link href="/schedule">{planned ? "Schedule →" : admin ? "Deduce schedule →" : "Schedule →"}</Link>
        {period && <Link href={`/payments?p=${start}#p-${start}`}>Payment →</Link>}
      </div>
    </div>
  );
}
