import Link from "next/link";
import { after } from "next/server";
import PaymentCard from "@/components/PaymentCard";
import CurrentPeriodCard from "@/components/CurrentPeriodCard";
import ScheduleDay from "@/components/ScheduleDay";
import { addDays, buildPeriods, fmtDate, fmtDow, fmtLocalTime, holidayHours, hrs, sickHours, totalHours, vacationHours, workedHours, needsAttention, periodStart, periodStatus, todayET, type DayRow, type Period, type PeriodStatus } from "@/lib/calc";
import { getEventsOn, hasUnsyncedCalendar, listCalendars, syncAll, type DayEvent } from "@/lib/calendar";
import { getDays, getPayments, getSettings } from "@/lib/db";
import { getScheduleDays, scheduledTotal } from "@/lib/schedule";
import { isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The same calendar day two months earlier (clamped to the month's last day). */
function monthsAgo(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 - n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 - n, Math.min(d, last))).toISOString().slice(0, 10);
}

export default async function Home({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const today = todayET();

  // A calendar that has never synced is fetched before rendering; stale ones refresh after the response.
  if (await hasUnsyncedCalendar()) await syncAll(true);
  else after(() => syncAll(true));

  const upcoming = [today, addDays(today, 1), addDays(today, 2)];
  const curStart = periodStart(today);
  const [days, payments, settings, calendars, admin, schedule, ...eventsByDay] = await Promise.all([
    getDays(), getPayments(), getSettings(), listCalendars(), isAdmin(),
    // the current pay period plus anything of the next 3 days that spills into the next one
    getScheduleDays(curStart, addDays(curStart, 13)), ...upcoming.map(getEventsOn),
  ]);
  const periods = buildPeriods(days, payments, settings);
  const items = periods.map((period) => ({ period, status: periodStatus(period, today) }));

  const current = items.find((i) => i.period.start === curStart);
  const showAdmin = admin && tab === "admin";
  const scheduleByDate = new Map(schedule.map((d) => [d.date, d]));
  const dayByDate = new Map(days.map((d) => [d.date, d]));
  const periodSchedule = schedule.filter((d) => d.date <= addDays(curStart, 6));
  const planned = periodSchedule.length ? scheduledTotal(periodSchedule) : null;
  const periodCard = <CurrentPeriodCard start={curStart} period={current?.period} status={current?.status} planned={planned} admin={admin} />;

  return (
    <>
      {admin && (
        <div className="tabs">
          <Link href="/" className={showAdmin ? "" : "on"}>Main</Link>
          <Link href="/?tab=admin" className={showAdmin ? "on" : ""}>Admin</Link>
        </div>
      )}
      {showAdmin ? (
        <AdminTab items={items} curStart={curStart} today={today} venmoHandle={settings.venmoHandle} periodCard={periodCard} />
      ) : (
        <>
          <TodaySummary days={days} today={today} curStart={curStart} />

          <section className="section">
            <h2>This pay period</h2>
            {periodCard}
          </section>

          <section className="section">
            <h2>Schedule · next 3 days</h2>
            {schedule.length === 0 ? (
              <p className="muted small">
                No schedule deduced yet. <Link href="/schedule">{admin ? "Deduce it →" : "Schedule →"}</Link>
              </p>
            ) : (
              upcoming.map((date, i) =>
                scheduleByDate.has(date) ? (
                  <ScheduleDay key={date} label={dayLabel(date, i)} day={scheduleByDate.get(date)!} logged={dayByDate.get(date)} today={today} />
                ) : (
                  <div key={date} className="sched">
                    <div className="schedtop"><span className="schedlabel">{dayLabel(date, i)}</span><span className="muted">Not deduced</span></div>
                  </div>
                ),
              )
            )}
          </section>

          <section className="section">
            <h2>Calendar · next 3 days</h2>
            {calendars.length === 0 ? (
              <p className="muted small">No calendars connected. <Link href="/settings">Add one in settings.</Link></p>
            ) : (
              upcoming.map((date, i) => (
                <div key={date} className="agday">
                  <h3 className="dayhead">{dayLabel(date, i)}</h3>
                  {eventsByDay[i].length > 0 ? (
                    eventsByDay[i].map((e) => <Event key={e.id} e={e} />)
                  ) : (
                    <p className="muted small">Nothing on the calendar.</p>
                  )}
                </div>
              ))
            )}
          </section>
        </>
      )}
    </>
  );
}

const dayLabel = (date: string, i: number) => `${i === 0 ? "Today" : i === 1 ? "Tomorrow" : fmtDow(date)} · ${fmtDate(date)}`;

/** Hours logged today, or a reminder to log them, plus any weekdays earlier this pay period left blank. */
function TodaySummary({ days, today, curStart }: { days: DayRow[]; today: string; curStart: string }) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const row = byDate.get(today);
  const logged = row ? totalHours(row) : 0;
  const missing: string[] = [];
  for (let d = curStart; d < today; d = addDays(d, 1)) {
    const dow = fmtDow(d);
    const r = byDate.get(d);
    if (dow !== "Sat" && dow !== "Sun" && !(r && totalHours(r) > 0)) missing.push(d);
  }
  const parts = row
    ? ([["worked", workedHours(row)], ["vacation", vacationHours(row)], ["sick", sickHours(row)], ["holiday", holidayHours(row)]] as const)
        .filter(([, h]) => h > 0)
        .map(([k, h]) => `${hrs(h)} ${k}`)
    : [];

  return (
    <section className="section">
      <h2>Today · {fmtDow(today)} {fmtDate(today)}</h2>
      {logged > 0 ? (
        <Link href="/timesheet" className="banner ok">
          {hrs(logged)} h logged today{parts.length > 1 ? ` (${parts.join(", ")})` : ""} · edit →
        </Link>
      ) : (
        <Link href="/timesheet" className="banner warn">No hours logged yet today · log them →</Link>
      )}
      {missing.length > 0 && (
        <p className="small">
          Also no hours on{" "}
          {missing.map((d, i) => (
            <span key={d}>
              {i > 0 && ", "}
              <Link href={`/timesheet?d=${d}`}>{fmtDow(d)} {fmtDate(d)}</Link>
            </span>
          ))}
          .
        </p>
      )}
    </section>
  );
}

type Item = { period: Period; status: PeriodStatus };

function AdminTab({ items, curStart, today, venmoHandle, periodCard }: {
  items: Item[]; curStart: string; today: string; venmoHandle: string; periodCard: React.ReactNode;
}) {
  const lastStart = addDays(curStart, -7);
  const last = items.find((i) => i.period.start === lastStart);
  const cutoff = monthsAgo(today, 2);
  const delinquent = items.filter((i) => i.period.start !== lastStart && i.period.end >= cutoff && needsAttention(i.status));
  const flagged = delinquent.length + (last && needsAttention(last.status) ? 1 : 0);
  const card = (i: Item) => (
    <PaymentCard key={i.period.start} period={i.period} editable today={today} venmoHandle={venmoHandle} />
  );

  return (
    <>
      {flagged > 0 ? (
        <div className="banner warn">
          {flagged} pay period{flagged === 1 ? "" : "s"} since {fmtDate(cutoff)} not approved or not balanced
        </div>
      ) : (
        <div className="banner ok">Every pay period since {fmtDate(cutoff)} is approved and balanced.</div>
      )}

      <section className="section">
        <h2>This pay period</h2>
        {periodCard}
      </section>

      <section className="section">
        <h2>Last pay period</h2>
        {last ? card(last) : <p className="muted small">No activity recorded for the last pay period.</p>}
      </section>

      <section className="section">
        <h2>Delinquent since {fmtDate(cutoff)}</h2>
        {delinquent.length > 0 ? delinquent.map(card) : <p className="muted small">None.</p>}
      </section>
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
