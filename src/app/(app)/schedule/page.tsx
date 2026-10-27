import Link from "next/link";
import { after } from "next/server";
import CalendarTabs from "@/components/CalendarTabs";
import ScheduleControls from "@/components/ScheduleControls";
import ScheduleDay from "@/components/ScheduleDay";
import { addDays, fmtDate, fmtDateTime, fmtDow, hrs, periodId, periodStart, todayET, workedHours } from "@/lib/calc";
import { hasUnsyncedCalendar, listCalendars, syncAll } from "@/lib/calendar";
import { getDayRange, getSettings } from "@/lib/db";
import { getScheduleDays, hasApiKey, scheduledTotal } from "@/lib/schedule";
import { isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const isDate = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const today = todayET();
  const start = periodStart(isDate(p) ? p : today);
  const end = addDays(start, 6);

  if (await hasUnsyncedCalendar()) await syncAll(true);
  else after(() => syncAll(true));

  const [calendars, days, logged, settings, admin] = await Promise.all([
    listCalendars(), getScheduleDays(start, end), getDayRange(start, end), getSettings(), isAdmin(),
  ]);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const loggedByDate = new Map(logged.map((d) => [d.date, d]));
  const total = scheduledTotal(days);
  const loggedWorked = logged.reduce((n, d) => n + workedHours(d), 0);
  const lastRun = days.reduce((t, d) => (d.created_at > t ? d.created_at : t), "");
  const usedModels = [...new Set(days.map((d) => d.model).filter(Boolean))].join(", ");
  const scheduleCals = calendars.filter((c) => c.is_schedule);

  return (
    <>
      <CalendarTabs on="schedule" />
      <div className="datebar">
        <div>
          <div className="bigdate">{fmtDate(start)} – {fmtDate(end)}</div>
          <div className="muted small">Pay period {periodId(start)}</div>
        </div>
        <div className="arrows">
          <Link className="btn small" href={`/schedule?p=${addDays(start, -7)}`} aria-label="Previous pay period">◀</Link>
          <Link className="btn small" href="/schedule">This period</Link>
          <Link className="btn small" href={`/schedule?p=${addDays(start, 7)}`} aria-label="Next pay period">▶</Link>
        </div>
      </div>

      {admin ? (
        <ScheduleControls
          key={start}
          start={start}
          calendars={calendars.filter((c) => c.enabled).map((c) => ({ id: c.id, label: c.label, color: c.color, is_schedule: c.is_schedule }))}
          hints={settings.scheduleHints}
          model={settings.scheduleModel}
          effort={settings.scheduleEffort}
          hasKey={hasApiKey()}
          hasRun={days.length > 0}
        />
      ) : (
        <p className="muted small">
          Schedule calendars: {scheduleCals.length ? scheduleCals.map((c) => c.label).join(", ") : "none"}.{" "}
          <Link href="/admin?next=/schedule">Unlock admin mode</Link> to deduce the schedule.
        </p>
      )}

      {days.length === 0 ? (
        <p className="muted">No schedule deduced for this pay period yet.</p>
      ) : (
        <>
          <div className="stats">
            <div className="stat">
              <div className="n">{hrs(total.minutes / 60)}</div>
              <div className="k">scheduled hours{total.open > 0 ? ` + ${total.open} day${total.open === 1 ? "" : "s"} without a total` : ""}</div>
            </div>
            <div className="stat"><div className="n">{hrs(loggedWorked)}</div><div className="k">worked hours logged</div></div>
            <div className="stat"><div className="n">{total.working}</div><div className="k">working days</div></div>
          </div>
          <p className="muted small">
            Deduced {fmtDateTime(lastRun)}{usedModels ? ` with ${usedModels}` : ""}. Times marked ~ come from other events or were assumed, so those days get no hour total.
          </p>
          {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((date) => {
            const day = byDate.get(date);
            return (
              <section key={date} className="agday">
                <h2>
                  {fmtDow(date)} {fmtDate(date)}
                  {date === today && <span className="pill">Today</span>}
                </h2>
                {day ? <ScheduleDay day={day} logged={loggedByDate.get(date)} today={today} detail /> : <p className="muted small">Not deduced.</p>}
              </section>
            );
          })}
        </>
      )}
    </>
  );
}
