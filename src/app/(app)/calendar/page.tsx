import { after } from "next/server";
import CalendarTabs from "@/components/CalendarTabs";
import CalendarView from "@/components/CalendarView";
import { addDays, todayET } from "@/lib/calc";
import { getAllEvents, hasUnsyncedCalendar, listCalendars, syncAll, WINDOW_AHEAD_DAYS, WINDOW_BACK_DAYS } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const today = todayET();

  // Same rule as Home: a never-synced calendar is fetched first; stale ones refresh after the response.
  if (await hasUnsyncedCalendar()) await syncAll(true);
  else after(() => syncAll(true));

  const [calendars, events] = await Promise.all([listCalendars(), getAllEvents()]);

  return (
    <div className="calpage">
      <CalendarTabs on="calendar" />
      <CalendarView
        calendars={calendars.filter((c) => c.enabled).map((c) => ({ id: c.id, label: c.label, color: c.color }))}
        events={events}
        today={today}
        from={addDays(today, -WINDOW_BACK_DAYS)}
        to={addDays(today, WINDOW_AHEAD_DAYS)}
      />
    </div>
  );
}
