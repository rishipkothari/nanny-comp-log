import Link from "next/link";
import Nav from "@/components/Nav";
import DayForm from "@/components/DayForm";
import { addDays, fmtDate, todayET, type DayRow } from "@/lib/calc";
import { getDay } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Timesheet({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { d } = await searchParams;
  const date = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayET();
  const row: DayRow = (await getDay(date)) ?? {
    date,
    hours: 0,
    minutes: 0,
    stipend: 0,
    expenses: 0,
    vacation: 0,
    sick: 0,
    holiday: false,
    notes: "",
  };
  return (
    <main>
      <div className="datebar">
        <h1>Timesheet</h1>
        <div className="arrows">
          <Link className="btn small" href={`/?d=${addDays(date, -1)}`} aria-label="Previous day">◀</Link>
          <Link className="btn small" href="/">Today</Link>
          <Link className="btn small" href={`/?d=${addDays(date, 1)}`} aria-label="Next day">▶</Link>
        </div>
      </div>
      <div className="field">
        <span className="l">Date</span>
        <span>{fmtDate(date)}</span>
      </div>
      <DayForm key={date} initial={row} />
      <Nav active="timesheet" />
    </main>
  );
}
