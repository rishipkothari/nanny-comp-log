import { fmtClock, hrs, type DayRow } from "@/lib/calc";
import type { Block, ScheduleDay as Day } from "@/lib/schedule";
import LogHoursButton from "./LogHoursButton";

const when = (b: Block) =>
  `${b.start_basis === "stated" ? "" : "~"}${fmtClock(b.start)} – ${b.end_basis === "stated" ? "" : "~"}${fmtClock(b.end)}`;

/**
 * One deduced day: its blocks, the hour total when every time was written out as the nanny's
 * hours, and (for today or earlier) a button that logs that total.
 */
export default function ScheduleDay({ day, logged, today, detail = false }: { day: Day; logged: DayRow | undefined; today: string; detail?: boolean }) {
  const loggedMinutes = logged ? logged.wh * 60 + logged.wm : 0;
  const canLog = day.total_minutes !== null && day.total_minutes > 0 && day.date <= today && loggedMinutes !== day.total_minutes;

  return (
    <div className="sched">
      <div className="schedtop">
        <span className="schedlabel">Schedule</span>
        {!day.working ? (
          <span className="muted">Not working</span>
        ) : (
          <span className="blocks">
            {day.blocks.map((b, i) => (
              <span key={i} className="blk" title={b.sources.length ? `From: ${b.sources.join(", ")}` : undefined}>{when(b)}</span>
            ))}
          </span>
        )}
        <span className="schedtotal">
          {!day.working ? "" : day.total_minutes !== null ? `${hrs(day.total_minutes / 60)} h` : "no total"}
        </span>
      </div>
      {(detail || day.confidence === "low") && (
        <div className="muted small">
          {day.confidence !== "high" && <span className={`pill conf ${day.confidence}`}>{day.confidence} confidence</span>} {day.explanation}
        </div>
      )}
      {detail && day.working && day.blocks.some((b) => b.sources.length) && (
        <div className="muted small">From: {[...new Set(day.blocks.flatMap((b) => b.sources))].join(" · ")}</div>
      )}
      {canLog && (
        <div className="savebar">
          <LogHoursButton date={day.date} minutes={day.total_minutes!} loggedMinutes={loggedMinutes} />
          {loggedMinutes > 0 && <span className="muted small">{hrs(loggedMinutes / 60)} h logged</span>}
        </div>
      )}
    </div>
  );
}
