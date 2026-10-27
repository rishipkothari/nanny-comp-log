import Link from "next/link";

/** Schedule lives under the calendar: both pages share these tabs. */
export default function CalendarTabs({ on }: { on: "calendar" | "schedule" }) {
  return (
    <div className="tabs">
      <Link href="/calendar" className={on === "calendar" ? "on" : ""}>Calendar</Link>
      <Link href="/schedule" className={on === "schedule" ? "on" : ""}>Schedule</Link>
    </div>
  );
}
