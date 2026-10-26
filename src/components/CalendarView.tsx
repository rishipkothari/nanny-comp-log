"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addDays, fmtDate, fmtDow, fmtLocalTime } from "@/lib/calc";
import type { DayEvent } from "@/lib/calendar";

type Cal = { id: number; label: string; color: string };
type Props = { calendars: Cal[]; events: DayEvent[]; today: string; from: string; to: string };
type Item = { e: DayEvent; when: string };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

/** The dates an event covers: all-day ends are exclusive, and a timed event ending at midnight stops the day before. */
function coveredDays(e: DayEvent): string[] {
  const first = e.start.slice(0, 10);
  let last = e.end.slice(0, 10);
  if (e.end > e.start && (e.all_day || e.end.slice(11) === "00:00:00")) last = addDays(last, -1);
  if (last < first) last = first;
  const days: string[] = [];
  for (let d = first; d <= last && days.length < 400; d = addDays(d, 1)) days.push(d);
  return days;
}

function whenLabel(e: DayEvent, day: string): string {
  if (e.all_day) return "All day";
  const startDay = e.start.slice(0, 10);
  const endDay = e.end.slice(0, 10);
  if (startDay === day) return endDay === day ? `${fmtLocalTime(e.start)} – ${fmtLocalTime(e.end)}` : fmtLocalTime(e.start);
  if (endDay === day) return `until ${fmtLocalTime(e.end)}`;
  return "All day";
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function shiftMonth(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export default function CalendarView({ calendars, events, today, from, to }: Props) {
  // Selection is deliberately not remembered: every visit starts with all calendars on.
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [view, setView] = useState<"agenda" | "month">("agenda");
  const [month, setMonth] = useState(monthKey(today));
  const [picked, setPicked] = useState(today);
  const [showPast, setShowPast] = useState(false);

  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const e of events) {
      if (hidden.has(e.calendar_id)) continue;
      for (const day of coveredDays(e)) {
        if (day < from || day > to) continue;
        const list = map.get(day) ?? [];
        list.push({ e, when: whenLabel(e, day) });
        map.set(day, list);
      }
    }
    return map;
  }, [events, hidden, from, to]);

  const toggle = (id: number) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (calendars.length === 0) {
    return (
      <p className="muted">
        No calendars connected. <Link href="/settings">Add one in settings.</Link>
      </p>
    );
  }

  return (
    <>
      <div className="chips" role="group" aria-label="Calendars">
        {calendars.map((c) => {
          const on = !hidden.has(c.id);
          return (
            <button key={c.id} className={`chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggle(c.id)}>
              <span className="dot" style={{ background: on ? c.color : "transparent", borderColor: c.color }} />
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="seg" role="group" aria-label="View">
        <button className={view === "agenda" ? "on" : ""} aria-pressed={view === "agenda"} onClick={() => setView("agenda")}>Agenda</button>
        <button className={view === "month" ? "on" : ""} aria-pressed={view === "month"} onClick={() => setView("month")}>Month</button>
      </div>

      {view === "agenda" ? (
        <Agenda byDay={byDay} today={today} from={from} to={to} showPast={showPast} setShowPast={setShowPast} />
      ) : (
        <Month
          byDay={byDay} today={today} from={from} to={to} month={month} setMonth={setMonth} picked={picked} setPicked={setPicked}
        />
      )}
    </>
  );
}

function Agenda({ byDay, today, from, to, showPast, setShowPast }: {
  byDay: Map<string, Item[]>; today: string; from: string; to: string; showPast: boolean; setShowPast: (v: boolean) => void;
}) {
  const days = [...byDay.keys()].filter((d) => d >= (showPast ? from : today) && d <= to).sort();
  const hasPast = [...byDay.keys()].some((d) => d < today);

  return (
    <>
      {hasPast && (
        <p>
          <button className="small" onClick={() => setShowPast(!showPast)}>{showPast ? "Hide earlier events" : "Show earlier events"}</button>
        </p>
      )}
      {days.length === 0 && <p className="muted">Nothing scheduled.</p>}
      {days.map((d) => (
        <section key={d} className="agday">
          <h2>
            {fmtDow(d)} {fmtDate(d)}
            {d === today && <span className="pill">Today</span>}
          </h2>
          {byDay.get(d)!.map((it, i) => (
            <Row key={`${it.e.id}-${i}`} it={it} />
          ))}
        </section>
      ))}
    </>
  );
}

function Row({ it }: { it: Item }) {
  return (
    <div className="event">
      <span className="bar" style={{ background: it.e.color }} />
      <div>
        <div className="when">{it.when}</div>
        <div>{it.e.title}</div>
      </div>
    </div>
  );
}

function Month({ byDay, today, from, to, month, setMonth, picked, setPicked }: {
  byDay: Map<string, Item[]>; today: string; from: string; to: string;
  month: string; setMonth: (m: string) => void; picked: string; setPicked: (d: string) => void;
}) {
  const [y, m] = month.split("-").map(Number);
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const length = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);

  const canPrev = monthKey(from) < month;
  const canNext = monthKey(to) > month;
  const go = (key: string) => {
    setMonth(key);
    setPicked(key === monthKey(today) ? today : `${key}-01`);
  };
  const pickedItems = byDay.get(picked) ?? [];

  return (
    <>
      <div className="monthbar">
        <button onClick={() => go(shiftMonth(month, -1))} disabled={!canPrev} aria-label="Previous month">‹</button>
        <strong>{MONTHS[m - 1]} {y}</strong>
        <button onClick={() => go(shiftMonth(month, 1))} disabled={!canNext} aria-label="Next month">›</button>
        {month !== monthKey(today) && <button className="small" onClick={() => go(monthKey(today))}>Today</button>}
      </div>

      <div className="mgrid" role="grid" aria-label={`${MONTHS[m - 1]} ${y}`}>
        {DOW.map((d, i) => <div key={i} className="mdow">{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="mcell blank" />;
          const items = byDay.get(d) ?? [];
          const colors = [...new Set(items.map((it) => it.e.color))].slice(0, 4);
          const out = d < from || d > to;
          return (
            <button
              key={i}
              className={`mcell${d === today ? " today" : ""}${d === picked ? " picked" : ""}${out ? " out" : ""}`}
              onClick={() => setPicked(d)}
              aria-label={`${fmtDow(d)} ${fmtDate(d)}, ${items.length} event${items.length === 1 ? "" : "s"}`}
            >
              <span className="num">{Number(d.slice(8))}</span>
              <span className="dots">{colors.map((c) => <i key={c} style={{ background: c }} />)}</span>
            </button>
          );
        })}
      </div>

      <section className="agday">
        <h2>
          {fmtDow(picked)} {fmtDate(picked)}
          {picked === today && <span className="pill">Today</span>}
        </h2>
        {pickedItems.length === 0 ? <p className="muted small">Nothing scheduled.</p> : pickedItems.map((it, i) => <Row key={`${it.e.id}-${i}`} it={it} />)}
      </section>
    </>
  );
}
