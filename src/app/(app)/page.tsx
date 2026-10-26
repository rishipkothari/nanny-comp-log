import Link from "next/link";
import { after } from "next/server";
import PaymentCard from "@/components/PaymentCard";
import PeriodSummary from "@/components/PeriodSummary";
import { addDays, buildPeriods, fmtDate, fmtDow, fmtLocalTime, hrs, money, needsAttention, periodStart, periodStatus, todayET, type Period, type PeriodStatus } from "@/lib/calc";
import { getEventsOn, hasUnsyncedCalendar, listCalendars, syncAll, type DayEvent } from "@/lib/calendar";
import { getDays, getPayments, getSettings } from "@/lib/db";
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

  const [days, payments, settings, events, calendars, admin] = await Promise.all([
    getDays(), getPayments(), getSettings(), getEventsOn(today), listCalendars(), isAdmin(),
  ]);
  const periods = buildPeriods(days, payments, settings);
  const items = periods.map((period) => ({ period, status: periodStatus(period, today) }));

  const curStart = periodStart(today);
  const current = items.find((i) => i.period.start === curStart);
  const showAdmin = admin && tab === "admin";

  return (
    <>
      {admin && (
        <div className="tabs">
          <Link href="/" className={showAdmin ? "" : "on"}>Main</Link>
          <Link href="/?tab=admin" className={showAdmin ? "on" : ""}>Admin</Link>
        </div>
      )}
      {showAdmin ? (
        <AdminTab items={items} curStart={curStart} today={today} venmoHandle={settings.venmoHandle} />
      ) : (
        <>
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
            <p className="small"><Link href="/timesheet">Open today&apos;s timesheet →</Link></p>
          </section>

          <section className="section">
            <h2>This pay period · {fmtDate(curStart)} – {fmtDate(addDays(curStart, 6))}</h2>
            <div className="stats">
              <div className="stat"><div className="n">{hrs(current?.period.total ?? 0)}</div><div className="k">hours so far</div></div>
              <div className="stat"><div className="n">{hrs(current?.period.ot ?? 0)}</div><div className="k">overtime hours</div></div>
              <div className="stat"><div className="n">{money(current?.period.personalDue ?? 0)}</div><div className="k">personal due so far</div></div>
            </div>
            <p className="small"><Link href={`/timesheet?view=period&p=${curStart}`}>Edit this pay period →</Link></p>
          </section>
        </>
      )}
    </>
  );
}

type Item = { period: Period; status: PeriodStatus };

function AdminTab({ items, curStart, today, venmoHandle }: { items: Item[]; curStart: string; today: string; venmoHandle: string }) {
  const current = items.find((i) => i.period.start === curStart);
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
        {current ? <PeriodSummary period={current.period} status={current.status} /> : <p className="muted small">Nothing recorded yet this pay period.</p>}
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
