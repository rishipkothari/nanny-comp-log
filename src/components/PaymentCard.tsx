"use client";

import { useState } from "react";
import { fmtDate, hrs, money, venmoNote, type Period } from "@/lib/calc";

const ROUTES = ["Venmo", "Cash", "Zelle"];

export default function PaymentCard({ period }: { period: Period }) {
  const p = period.payment;
  const [f, setF] = useState({
    homepay_earnings: p?.homepay_earnings?.toString() ?? "",
    homepay_net: p?.homepay_net?.toString() ?? "",
    homepay_date: p?.homepay_date ?? "",
    personal_paid: p?.personal_paid?.toString() ?? "",
    personal_date: p?.personal_date ?? "",
    route: p?.route ?? "",
    notes: p?.notes ?? "",
  });
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [copied, setCopied] = useState(false);
  const set = (k: keyof typeof f, v: string) => {
    setF((prev) => ({ ...prev, [k]: v }));
    setState("idle");
  };

  const net = Number(f.homepay_net) || 0;
  const paid = Number(f.personal_paid) || 0;
  const outstanding = period.personalDue - paid;
  const settled = Math.abs(outstanding) < 0.005;

  async function save() {
    setState("saving");
    try {
      const res = await fetch("/api/payment", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ period_start: period.start, ...f }),
      });
      setState(res.ok ? "saved" : "error");
    } catch {
      setState("error");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(venmoNote(period));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <details className="card">
      <summary>
        <div>
          <div>
            {fmtDate(period.start)} – {fmtDate(period.end)}
          </div>
          <div className="sub">
            {hrs(period.total)} h · personal due {money(period.personalDue)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div>{money(net + paid)}</div>
          <span className={settled ? "pill ok" : "pill"}>{settled ? "settled" : `${money(outstanding)} owed`}</span>
        </div>
      </summary>
      <div className="body">
        <div className="rowline"><span>Personal comp due</span><b>{money(period.personalDue)}</b></div>
        <div className="field">
          <label>Homepay earnings</label>
          <input type="number" inputMode="decimal" step="any" value={f.homepay_earnings} onChange={(e) => set("homepay_earnings", e.target.value)} />
        </div>
        <div className="field">
          <label>Homepay net paid</label>
          <input type="number" inputMode="decimal" step="any" value={f.homepay_net} onChange={(e) => set("homepay_net", e.target.value)} />
        </div>
        <div className="field">
          <label>Homepay paid date</label>
          <input type="date" value={f.homepay_date} onChange={(e) => set("homepay_date", e.target.value)} />
        </div>
        <div className="field">
          <label>Personal comp paid</label>
          <input type="number" inputMode="decimal" step="any" value={f.personal_paid} onChange={(e) => set("personal_paid", e.target.value)} />
        </div>
        <div className="field">
          <label>Personal paid date</label>
          <input type="date" value={f.personal_date} onChange={(e) => set("personal_date", e.target.value)} />
        </div>
        <div className="field">
          <label>Route</label>
          <select value={f.route} onChange={(e) => set("route", e.target.value)}>
            <option value="">—</option>
            {ROUTES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Notes</label>
          <input type="text" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
        <div className="rowline"><span>Total paid</span><b>{money(net + paid)}</b></div>
        <div className="savebar">
          <button className="primary" onClick={save} disabled={state === "saving"}>
            {state === "saving" ? "Saving…" : "Save"}
          </button>
          <button onClick={copy}>{copied ? "Copied" : "Copy Venmo note"}</button>
          {state === "saved" && <span className="saved">Saved</span>}
          {state === "error" && <span className="err">Couldn’t save</span>}
        </div>
      </div>
    </details>
  );
}
