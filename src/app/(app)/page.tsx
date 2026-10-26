import Link from "next/link";
import DayForm from "@/components/DayForm";
import PeriodGrid from "@/components/PeriodGrid";
import { addDays, emptyDay, fmtDate, fmtDow, periodId, periodStart, todayET, type DayRow } from "@/lib/calc";
import { getDay, getDayRange, getSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

const isDate = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function Timesheet({ searchParams }: { searchParams: Promise<{ d?: string; view?: string; p?: string }> }) {
  const { d, view, p } = await searchParams;
  const period = view === "period";
  const today = todayET();

  return (
    <>
      <div className="tabs">
        <Link href={isDate(d) ? `/?d=${d}` : "/"} className={period ? "" : "on"}>Daily</Link>
        <Link href={isDate(p) ? `/?view=period&p=${p}` : "/?view=period"} className={period ? "on" : ""}>Pay period</Link>
      </div>
      {period ? <PeriodView anchor={isDate(p) ? p : today} /> : <DailyView date={isDate(d) ? d : today} />}
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
          <Link className="btn small" href={`/?d=${addDays(date, -1)}`} aria-label="Previous day">◀</Link>
          <Link className="btn small" href="/">Today</Link>
          <Link className="btn small" href={`/?d=${addDays(date, 1)}`} aria-label="Next day">▶</Link>
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
          <Link className="btn small" href={`/?view=period&p=${addDays(start, -7)}`} aria-label="Previous pay period">◀</Link>
          <Link className="btn small" href="/?view=period">This period</Link>
          <Link className="btn small" href={`/?view=period&p=${addDays(start, 7)}`} aria-label="Next pay period">▶</Link>
        </div>
      </div>
      <PeriodGrid key={start} initial={rows} settings={settings} />
    </>
  );
}
