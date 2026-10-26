"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSaver } from "@/lib/useSaver";
import SaveStatus from "./SaveStatus";

type Cal = { id: number; label: string; color: string; is_schedule: boolean };

/** Admin-only: which calendars hold the schedule, notes on how they are written, and the deduce button. */
export default function ScheduleControls({ start, calendars, hints, hasKey, hasRun }: {
  start: string; calendars: Cal[]; hints: string; hasKey: boolean; hasRun: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; tone: "err" | "muted" } | null>(null);
  const [cachedHit, setCachedHit] = useState(false);
  const [notes, setNotes] = useState(hints);
  const { statuses, queue, flush } = useSaver<{ scheduleHints: string }>("/api/settings");
  const tagged = calendars.filter((c) => c.is_schedule).length;

  async function toggle(c: Cal) {
    setBusy(`c${c.id}`);
    setMsg(null);
    try {
      const res = await fetch(`/api/calendars/${c.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ is_schedule: !c.is_schedule }) });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setMsg({ text: "Couldn’t save that change", tone: "err" });
    } finally {
      setBusy(null);
    }
  }

  async function deduce(force: boolean) {
    flush("hints");
    setBusy("deduce");
    setMsg(null);
    setCachedHit(false);
    try {
      const res = await fetch("/api/schedule/deduce", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ start, force }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ text: json.error ?? "Something went wrong", tone: "err" });
        return;
      }
      if (json.cached) {
        setCachedHit(true);
        setMsg({ text: "Nothing on the schedule calendar changed since the last run, so the saved schedule is shown.", tone: "muted" });
      }
      router.refresh();
    } catch {
      setMsg({ text: "Network error", tone: "err" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="schedctl">
      <h3 className="h3">Calendars with the schedule</h3>
      {calendars.length === 0 ? (
        <p className="muted small">No calendars connected yet. Add one in settings.</p>
      ) : (
        <div className="checks">
          {calendars.map((c) => (
            <label key={c.id} className="check">
              <input type="checkbox" checked={c.is_schedule} disabled={busy !== null} onChange={() => toggle(c)} />
              <span className="swatch" style={{ background: c.color }} />
              {c.label}
            </label>
          ))}
        </div>
      )}

      <h3 className="h3">How the calendar is written</h3>
      <textarea
        className="notes" rows={3} maxLength={2000} value={notes}
        placeholder={'e.g. All-day events starting with "AS" list the nanny\'s hours, like "AS 8-5:30".'}
        onChange={(e) => {
          setNotes(e.target.value);
          queue("hints", { scheduleHints: e.target.value });
        }}
        onBlur={() => flush("hints")}
      />
      <div className="savebar"><SaveStatus status={statuses.hints} /></div>

      <div className="savebar">
        <button className="primary" disabled={busy !== null || !hasKey || tagged === 0} onClick={() => deduce(false)}>
          {busy === "deduce" ? "Reading the calendar…" : hasRun ? "Update schedule from calendar" : "Deduce schedule from calendar"}
        </button>
        {(cachedHit || hasRun) && (
          <button className="small" disabled={busy !== null || !hasKey || tagged === 0} onClick={() => deduce(true)}>Run again anyway</button>
        )}
      </div>
      {!hasKey && <p className="err small">Set ANTHROPIC_API_KEY in the server environment to enable this.</p>}
      {hasKey && tagged === 0 && calendars.length > 0 && <p className="muted small">Tick at least one calendar above.</p>}
      {busy === "deduce" && <p className="muted small">This usually takes 10–40 seconds.</p>}
      {msg && <p className={`${msg.tone} small`}>{msg.text}</p>}
    </div>
  );
}
