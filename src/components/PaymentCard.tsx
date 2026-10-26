"use client";

import { useState } from "react";
import { fmtDate, hrs, money, venmoNote, type Period } from "@/lib/calc";
import { useSaver } from "@/lib/useSaver";
import SaveStatus from "./SaveStatus";

const ROUTES = ["Venmo", "Cash", "Zelle"];

export default function PaymentCard({ period, editable }: { period: Period; editable: boolean }) {
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
  const { statuses, queue, flush } = useSaver<Record<string, string>>("/api/payment");
  const [copied, setCopied] = useState(false);
  const key = period.start;

  const set = (k: keyof typeof f, v: string, now = false) => {
    const next = { ...f, [k]: v };
    setF(next);
    queue(key, { period_start: period.start, ...next });
    if (now) flush(key);
  };
  const blur = () => flush(key);

  const net = Number(f.homepay_net) || 0;
  const paid = Number(f.personal_paid) || 0;
  const outstanding = period.personalDue - paid;
  const settled = Math.abs(outstanding) < 0.005;

  async function copy() {
    try {
      await navigator.clipboard.writeText(venmoNote(period));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  const num = (k: "homepay_earnings" | "homepay_net" | "personal_paid", label: string) => (
    <div className="field">
      <label>{label}</label>
      {editable ? (
        <input type="number" inputMode="decimal" step="0.01" value={f[k]} onFocus={(e) => e.target.select()} onChange={(e) => set(k, e.target.value)} onBlur={blur} />
      ) : (
        <span className="ro">{f[k] === "" ? "—" : money(Number(f[k]))}</span>
      )}
    </div>
  );
  const date = (k: "homepay_date" | "personal_date", label: string) => (
    <div className="field">
      <label>{label}</label>
      {editable ? (
        <input type="date" value={f[k]} onChange={(e) => set(k, e.target.value, true)} onBlur={blur} />
      ) : (
        <span className="ro">{f[k] ? fmtDate(f[k]) : "—"}</span>
      )}
    </div>
  );

  return (
    <details className="card">
      <summary>
        <div>
          <div>{fmtDate(period.start)} – {fmtDate(period.end)}</div>
          <div className="sub">{hrs(period.total)} h · personal due {money(period.personalDue)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div>{money(net + paid)}</div>
          <span className={settled ? "pill ok" : "pill"}>{settled ? "settled" : `${money(outstanding)} owed`}</span>
        </div>
      </summary>
      <div className="body">
        <div className="rowline"><span>Personal comp due</span><b>{money(period.personalDue)}</b></div>
        {num("homepay_earnings", "Homepay earnings")}
        {num("homepay_net", "Homepay net paid")}
        {date("homepay_date", "Homepay paid date")}
        {num("personal_paid", "Personal comp paid")}
        {date("personal_date", "Personal paid date")}
        <div className="field">
          <label>Personal pay route</label>
          {editable ? (
            <select value={f.route} onChange={(e) => set("route", e.target.value, true)}>
              <option value="">—</option>
              {ROUTES.map((r) => <option key={r}>{r}</option>)}
            </select>
          ) : (
            <span className="ro">{f.route || "—"}</span>
          )}
        </div>
        <div className="field">
          <label>Notes</label>
          {editable ? (
            <input type="text" value={f.notes} onChange={(e) => set("notes", e.target.value)} onBlur={blur} />
          ) : (
            <span className="ro">{f.notes || "—"}</span>
          )}
        </div>
        <div className="rowline"><span>Total paid</span><b>{money(net + paid)}</b></div>
        <div className="savebar">
          <button onClick={copy}>{copied ? "Copied" : "Copy Venmo note"}</button>
          {editable && <SaveStatus status={statuses[key]} />}
        </div>
      </div>
    </details>
  );
}
