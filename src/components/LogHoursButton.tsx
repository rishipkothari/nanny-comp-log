"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fmtDate, hrs } from "@/lib/calc";

/** Puts a day's scheduled total into the timesheet as its working hours. */
export default function LogHoursButton({ date, minutes, loggedMinutes }: { date: string; minutes: number; loggedMinutes: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const h = hrs(minutes / 60);

  async function log() {
    if (loggedMinutes > 0 && !window.confirm(`Replace the ${hrs(loggedMinutes / 60)} working hours logged on ${fmtDate(date)} with ${h}?`)) return;
    setBusy(true);
    setErr(false);
    try {
      const res = await fetch("/api/schedule/apply", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ date }) });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="small primary" disabled={busy} onClick={log}>
        {busy ? "Logging…" : loggedMinutes > 0 ? `Set worked to ${h} h` : `Log ${h} h worked`}
      </button>
      {err && <span className="err small">Couldn’t log, try again</span>}
    </>
  );
}
