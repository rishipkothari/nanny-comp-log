"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import listPlugin from "@fullcalendar/react/list";
import classicThemePlugin from "@fullcalendar/react/themes/classic";
import type { DayEvent } from "@/lib/calendar";

import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "@fullcalendar/react/themes/classic/palette.css";

type Cal = { id: number; label: string; color: string };
type Props = { calendars: Cal[]; events: DayEvent[]; today: string; from: string; to: string };

export default function CalendarView({ calendars, events, today, from, to }: Props) {
  // Selection is deliberately not remembered: every visit starts with all calendars on.
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  // The library renders from the browser clock, so it is mounted client-side only to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Events carry wall-clock strings with no offset. With timeZone "UTC" the library shows them exactly as written.
  const shown = useMemo(
    () =>
      events
        .filter((e) => !hidden.has(e.calendar_id))
        .map((e) => ({
          id: String(e.id),
          title: e.title,
          allDay: e.all_day,
          start: e.all_day ? e.start.slice(0, 10) : e.start,
          end: e.all_day ? e.end.slice(0, 10) : e.end,
          color: e.color,
        })),
    [events, hidden],
  );

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

      <div className="fcwrap">
      {mounted && <FullCalendar
        plugins={[dayGridPlugin, listPlugin, classicThemePlugin]}
        timeZone="UTC"
        initialView="agenda"
        initialDate={today}
        views={{ agenda: { type: "list", duration: { days: 61 }, titleFormat: { month: "short", day: "numeric" } } }}
        buttons={{ agenda: { text: "Agenda" }, dayGridMonth: { text: "Month" } }}
        headerToolbar={{ start: "prev,next", center: "title", end: "agenda,dayGridMonth" }}
        validRange={{ start: from, end: to }}
        events={shown}
        height="auto"
        dayMaxEvents={3}
        noEventsText="Nothing scheduled."
      />}
      </div>
    </>
  );
}
