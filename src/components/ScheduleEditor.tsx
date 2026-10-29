"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fmtClock, fmtDate, fmtDow } from "@/lib/calc";
import type { DayCore, ScheduleDay } from "@/lib/schedule";
import Modal from "./Modal";

type Row = { start: string; end: string; label: string };

const summary = (d: DayCore) =>
  !d.working ? "Not working" : d.blocks.map((b) => `${fmtClock(b.start)} – ${fmtClock(b.end)}`).join(", ");

/**
 * Admin-only: an Edit button that opens a popup for entering a day's schedule by hand. The form
 * starts from the current day (hand-entered, else deduced); saving keeps it over later deductions,
 * and "Use deduced" drops the hand-entered day again.
 */
export default function ScheduleEditor({ date, day }: { date: string; day: ScheduleDay | undefined }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="small" onClick={() => setOpen(true)}>{day?.manual ? "Edit" : "Edit by hand"}</button>
      <Modal open={open} onClose={() => setOpen(false)}>
        <EditForm date={date} day={day} onClose={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function EditForm({ date, day, onClose }: { date: string; day: ScheduleDay | undefined; onClose: () => void }) {
  const router = useRouter();
  const deduced = day ? (day.manual ? day.deduced : day) : null;
  const [working, setWorking] = useState(day?.working ?? false);
  const [rows, setRows] = useState<Row[]>(day?.blocks.map((b) => ({ start: b.start, end: b.end, label: b.label })) ?? []);
  const [note, setNote] = useState(day?.manual ? day.explanation : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setRow = (i: number, p: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const addRow = () => {
    const last = rows[rows.length - 1];
    setRows([...rows, last ? { start: last.end, end: last.end, label: "" } : { start: "08:00", end: "17:00", label: "" }]);
  };

  async function send(method: "PUT" | "DELETE") {
    setBusy(true);
    setErr(null);
    try {
      const body = method === "PUT" ? { date, working, blocks: rows, note } : { date };
      const res = await fetch("/api/schedule/day", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json.error ?? "Couldn’t save, try again");
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="head">
        <div>
          <div>{fmtDow(date)} {fmtDate(date)}</div>
          <div className="muted small">Edit schedule by hand</div>
        </div>
        <div className="headright">
          <button type="button" className="small" onClick={onClose} aria-label="Close">✕</button>
        </div>
      </div>
      <div className="body schededit">
        <div className="field">
          <label htmlFor={`w-${date}`}>Working</label>
          <input
            id={`w-${date}`} type="checkbox" checked={working}
            onChange={(e) => {
              setWorking(e.target.checked);
              if (e.target.checked && rows.length === 0) addRow();
            }}
          />
        </div>
        {working && (
          <>
            {rows.map((r, i) => (
              <div key={i} className="blockrow">
                <input type="time" aria-label="Start" value={r.start} onChange={(e) => setRow(i, { start: e.target.value })} />
                <span className="muted">–</span>
                <input type="time" aria-label="End" value={r.end} onChange={(e) => setRow(i, { end: e.target.value })} />
                <input type="text" aria-label="Label" placeholder="Label" maxLength={60} value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} />
                <button type="button" className="small" aria-label="Remove block" onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button type="button" className="small addblock" onClick={addRow}>+ Add block</button>
          </>
        )}
        <div className="field">
          <label htmlFor={`n-${date}`}>Note</label>
          <input id={`n-${date}`} type="text" maxLength={500} value={note} placeholder="Optional" onChange={(e) => setNote(e.target.value)} />
        </div>
        <p className="muted small">Deduced: {deduced ? summary(deduced) : "not run for this day"}</p>
        {err && <p className="err small">{err}</p>}
        <div className="savebar">
          <button type="button" className="primary" disabled={busy} onClick={() => send("PUT")}>{busy ? "Saving…" : "Save"}</button>
          {day?.manual && (
            <button type="button" className="danger small" disabled={busy} onClick={() => send("DELETE")}>
              {deduced ? "Use deduced" : "Clear"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
