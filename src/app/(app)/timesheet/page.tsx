import Link from "next/link";
import DayForm from "@/components/DayForm";
import PeriodGrid from "@/components/PeriodGrid";
import { HoursTable } from "@/components/SummaryTables";
import { addDays, buildPeriods, emptyDay, fmtDate, fmtDow, hoursRows, periodId, periodStart, todayET, type DayRow } from "@/lib/calc";
import { getDay, getDayRange, getDays, getPayments, getSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

const isDate = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function Timesheet({ searchParams }: { searchParams: Promise<{ d?: string; view?: string; p?: string }> }) {
  const { d, view, p } = await searchParams;
  const period = view === "period";
  const summary = view === "summary";
  const today = todayET();

  return (
    <>
      <div className="tabs">
        <Link href={isDate(d) ? `/timesheet?d=${d}` : "/timesheet"} className={period || summary ? "" : "on"}>Daily</Link>
        <Link href={isDate(p) ? `/timesheet?view=period&p=${p}` : "/timesheet?view=period"} className={period ? "on" : ""}>Pay period</Link>
        <Link href="/timesheet?view=summary" className={summary ? "on" : ""}>Summary</Link>
      </div>
      {summary ? <SummaryView today={today} /> : period ? <PeriodView anchor={isDate(p) ? p : today} /> : <DailyView date={isDate(d) ? d : today} />}
    </>
  );
}

async function DailyView({ date }: { date: string }) {
  const row: DayRow = (await getDay(date)) ?? emptyDay(date);
  return (
    <>
      <div className="datebar">
        <div>
          <div className="bigdate">{fmtDow(date)} {fmtDate(date)}</div>
          <div className="muted small">Pay period {periodId(periodStart(date))}</div>
        </div>
        <div className="arrows">
          <Link className="btn small" href={`/timesheet?d=${addDays(date, -1)}`} aria-label="Previous day">◀</Link>
          <Link className="btn small" href="/timesheet">Today</Link>
          <Link className="btn small" href={`/timesheet?d=${addDays(date, 1)}`} aria-label="Next day">▶</Link>
        </div>
      </div>
      <DayForm key={date} initial={row} />
    </>
  );
}

async function PeriodView({ anchor }: { anchor: string }) {
  const start = periodStart(anchor);
  const end = addDays(start, 6);
  const [existing, settings] = await Promise.all([getDayRange(start, end), getSettings()]);
  const byDate = new Map(existing.map((r) => [r.date, r]));
  const rows = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    return byDate.get(date) ?? emptyDay(date);
  });
  return (
    <>
      <div className="datebar">
        <div>
          <div className="bigdate">{fmtDate(start)} – {fmtDate(end)}</div>
          <div className="muted small">Pay period {periodId(start)}</div>
        </div>
        <div className="arrows">
          <Link className="btn small" href={`/timesheet?view=period&p=${addDays(start, -7)}`} aria-label="Previous pay period">◀</Link>
          <Link className="btn small" href="/timesheet?view=period">This period</Link>
          <Link className="btn small" href={`/timesheet?view=period&p=${addDays(start, 7)}`} aria-label="Next pay period">▶</Link>
        </div>
      </div>
      <PeriodGrid key={start} initial={rows} settings={settings} />
    </>
  );
}

/** Read-only hours per pay period; a row opens that period in the batch editor. */
async function SummaryView({ today }: { today: string }) {
  const [days, payments, settings] = await Promise.all([getDays(), getPayments(), getSettings()]);
  const rows = hoursRows(days, buildPeriods(days, payments, settings), "period", today);
  return <HoursTable rows={rows} group="period" href={(r) => `/timesheet?view=period&p=${r.key}`} />;
}
