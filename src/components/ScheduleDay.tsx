import type { ReactNode } from "react";
import { fmtClock, hrs, type DayRow } from "@/lib/calc";
import type { Block, DayCore, ScheduleDay as Day } from "@/lib/schedule";
import LogHoursButton from "./LogHoursButton";

const when = (b: Block) =>
  `${b.start_basis === "stated" ? "" : "~"}${fmtClock(b.start)} – ${b.end_basis === "stated" ? "" : "~"}${fmtClock(b.end)}`;
const summary = (d: DayCore) => (d.working ? d.blocks.map(when).join(", ") : "not working");

/**
 * One deduced day: its blocks, the hour total when every time was written out as the nanny's
 * hours, and (for today or earlier) a button that logs that total. With `detail`, the reasoning
 * is rendered too, shown only inside a `.verbose` container. A hand-entered day is marked
 * "edited", with the deduced day beside it in the detail. `edit` goes next to the log button.
 */
export default function ScheduleDay({ day, logged, today, label = "Schedule", detail = false, edit }: {
  day: Day; logged: DayRow | undefined; today: string; label?: string; detail?: boolean; edit?: ReactNode;
}) {
  const loggedMinutes = logged ? logged.wh * 60 + logged.wm : 0;
  const canLog = day.total_minutes !== null && day.total_minutes > 0 && day.date <= today && loggedMinutes !== day.total_minutes;
  const sources = [...new Set(day.blocks.flatMap((b) => b.sources))];

  return (
    <div className="sched">
      <div className="schedtop">
        <span className="schedlabel">{label}</span>
        {!day.working ? (
          <span className="muted">Not working</span>
        ) : (
          <span className="blocks">
            {day.blocks.map((b, i) => (
              <span key={i} className="blk" title={b.sources.length ? `From: ${b.sources.join(", ")}` : undefined}>{when(b)}</span>
            ))}
          </span>
        )}
        {day.manual ? <span className="pill conf medium">edited</span> : day.confidence === "low" && <span className="pill conf low">low confidence</span>}
        <span className="schedtotal">
          {!day.working ? "" : day.total_minutes !== null ? `${hrs(day.total_minutes / 60)} h` : "no total"}
        </span>
      </div>
      {detail && (day.manual ? (
        <div className="vdetail muted small">
          {day.explanation && <div>{day.explanation}</div>}
          <div>Deduced: {day.deduced ? summary(day.deduced) : "not run for this day"}</div>
        </div>
      ) : (
        <div className="vdetail muted small">
          <div><span className={`pill conf ${day.confidence}`}>{day.confidence} confidence</span> {day.explanation}</div>
          {sources.length > 0 && <div>From: {sources.join(" · ")}</div>}
        </div>
      ))}
      {(canLog || edit) && (
        <div className="savebar">
          {canLog && <LogHoursButton date={day.date} minutes={day.total_minutes!} loggedMinutes={loggedMinutes} />}
          {canLog && loggedMinutes > 0 && <span className="muted small">{hrs(loggedMinutes / 60)} h logged</span>}
          {edit}
        </div>
      )}
    </div>
  );
}
