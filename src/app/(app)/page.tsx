import Link from "next/link";
import { after } from "next/server";
import PeriodSummary from "@/components/PeriodSummary";
import { addDays, buildPeriods, fmtDate, fmtDow, fmtLocalTime, hrs, money, needsAttention, periodStart, periodStatus, todayET } from "@/lib/calc";
import { getEventsOn, hasUnsyncedCalendar, listCalendars, syncAll, type DayEvent } from "@/lib/calendar";
import { getDays, getPayments, getSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const today = todayET();

  // A calendar that has never synced is fetched before rendering; stale ones refresh after the response.
  if (await hasUnsyncedCalendar()) await syncAll(true);
  else after(() => syncAll(true));

  const [days, payments, settings, events, calendars] = await Promise.all([
    getDays(), getPayments(), getSettings(), getEventsOn(today), listCalendars(),
  ]);
  const periods = buildPeriods(days, payments, settings);
  const items = periods.map((period) => ({ period, status: periodStatus(period, today) }));

  const curStart = periodStart(today);
  const current = items.find((i) => i.period.start === curStart);
  const last = items.find((i) => i.period.start === addDays(curStart, -7));
  const attention = items.filter((i) => needsAttention(i.status));
  const older = attention.filter((i) => i !== last);

  return (
    <>
      {attention.length > 0 ? (
        <a href="#attention" className="banner warn">
          {attention.length} pay period{attention.length === 1 ? "" : "s"} not settled yet
        </a>
      ) : (
        <div className="banner ok">All pay periods are settled.</div>
      )}

      <section className="section">
        <h2>Today · {fmtDow(today)} {fmtDate(today)}</h2>
        {events.length > 0 ? (
          events.map((e) => <Event key={e.id} e={e} />)
        ) : (
          <p className="muted small">
            {calendars.length === 0 ? (
              <>No calendars connected. <Link href="/settings">Add one in settings.</Link></>
            ) : (
              "Nothing on the calendar today."
            )}
          </p>
        )}
      </section>

      <section className="section">
        <h2>This pay period · {fmtDate(curStart)} – {fmtDate(addDays(curStart, 6))}</h2>
        <div className="stats">
          <div className="stat"><div className="n">{hrs(current?.period.total ?? 0)}</div><div className="k">hours so far</div></div>
          <div className="stat"><div className="n">{hrs(current?.period.ot ?? 0)}</div><div className="k">overtime hours</div></div>
          <div className="stat"><div className="n">{money(current?.period.personalDue ?? 0)}</div><div className="k">personal due so far</div></div>
        </div>
        <p className="small"><Link href={`/timesheet?view=period&p=${curStart}`}>Open this pay period →</Link></p>
      </section>

      <section className="section">
        <h2>Last pay period</h2>
        {last ? <PeriodSummary period={last.period} status={last.status} /> : <p className="muted small">No activity recorded for the last pay period.</p>}
      </section>

      {older.length > 0 && (
        <section className="section" id="attention">
          <h2>Still needs attention</h2>
          {older.map((i) => <PeriodSummary key={i.period.start} period={i.period} status={i.status} />)}
        </section>
      )}
    </>
  );
}

function Event({ e }: { e: DayEvent }) {
  return (
    <div className="event">
      <span className="bar" style={{ background: e.color }} />
      <div>
        <div>{e.title}</div>
        <div className="when">
          {e.all_day ? "All day" : `${fmtLocalTime(e.start)} – ${fmtLocalTime(e.end)}`}
          {e.location ? ` · ${e.location}` : ""} · {e.calendar}
        </div>
      </div>
    </div>
  );
}
