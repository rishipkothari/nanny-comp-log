"use client";

import { useEffect, useRef, useState } from "react";
import { fmtDate, fmtDateTime, hrs, money, periodStatus, venmoNote, type Period } from "@/lib/calc";
import { useSaver } from "@/lib/useSaver";
import SaveStatus from "./SaveStatus";
import StatusBadges from "./StatusBadges";
import VenmoBadge from "./VenmoBadge";

const ROUTES = ["Venmo", "Cash", "Zelle"];

type Props = { period: Period; editable: boolean; today: string; venmoHandle: string; defaultOpen?: boolean };

export default function PaymentCard({ period, editable, today, venmoHandle, defaultOpen = false }: Props) {
  const p = period.payment;
  const [f, setF] = useState({
    homepay_earnings: p?.homepay_earnings?.toString() ?? "",
    homepay_net: p?.homepay_net?.toString() ?? "",
    homepay_date: p?.homepay_date ?? "",
    personal_paid: p?.personal_paid?.toString() ?? "",
    personal_date: p?.personal_date ?? "",
    route: p?.route ?? "",
    notes: p?.notes ?? "",
    approved: p?.approved ?? false,
  });
  const [approvedAt, setApprovedAt] = useState(p?.approved_at ?? null);
  const { statuses, queue, flush } = useSaver<Record<string, string | boolean>>("/api/payment", 600, (_key, res) => {
    const r = res as { approved_at?: string | null } | null;
    if (r && "approved_at" in r) setApprovedAt(r.approved_at ?? null);
  });
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLDetailsElement>(null);
  const key = period.start;

  useEffect(() => {
    if (defaultOpen) ref.current?.scrollIntoView({ block: "start" });
  }, [defaultOpen]);

  const set = (k: keyof typeof f, v: string | boolean, now = false) => {
    const next = { ...f, [k]: v };
    setF(next);
    queue(key, { period_start: period.start, ...next });
    if (now) flush(key);
  };
  const blur = () => flush(key);

  const net = Number(f.homepay_net) || 0;
  const paid = Number(f.personal_paid) || 0;
  const status = periodStatus(
    { end: period.end, total: period.total, homepayNet: net, personalDue: period.personalDue, personalPaid: paid, approved: f.approved },
    today,
  );
  const outstanding = status.outstanding;
  const canVenmo = editable && !!venmoHandle && outstanding > 0.005 && (f.route === "" || f.route === "Venmo");

  async function copy() {
    try {
      await navigator.clipboard.writeText(venmoNote(period));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  /** Entering an empty field offers the likely value: today's date, or the amount still due. */
  const prefill = (k: keyof typeof f, value: string, el: HTMLInputElement) => {
    if (f[k] !== "" || !value) return;
    set(k, value);
    requestAnimationFrame(() => el.select?.());
  };

  const num = (k: "homepay_earnings" | "homepay_net" | "personal_paid", label: string) => (
    <div className="field">
      <label>{label}</label>
      {editable ? (
        <input
          type="number" inputMode="decimal" step="0.01" value={f[k]}
          onFocus={(e) => (k === "personal_paid" && outstanding > 0.005 ? prefill(k, outstanding.toFixed(2), e.target) : e.target.select())}
          onChange={(e) => set(k, e.target.value)} onBlur={blur}
        />
      ) : (
        <span className="ro">{f[k] === "" ? "—" : money(Number(f[k]))}</span>
      )}
    </div>
  );
  const date = (k: "homepay_date" | "personal_date", label: string) => (
    <div className="field">
      <label>{label}</label>
      {editable ? (
        <input type="date" value={f[k]} onFocus={(e) => prefill(k, today, e.target)} onChange={(e) => set(k, e.target.value, true)} onBlur={blur} />
      ) : (
        <span className="ro">{f[k] ? fmtDate(f[k]) : "—"}</span>
      )}
    </div>
  );

  return (
    <details ref={ref} id={`p-${period.start}`} className="card" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <div>
          <div>{fmtDate(period.start)} – {fmtDate(period.end)}</div>
          <div className="sub">{hrs(period.total)} h · personal due {money(period.personalDue)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div>{money(net + paid)}</div>
          <StatusBadges status={status} />
        </div>
      </summary>
      <div className="body">
        <div className="rowline"><span>Personal comp due</span><b>{money(period.personalDue)}</b></div>
        <div className="field">
          <label htmlFor={`ap-${key}`}>Hours approved</label>
          <div className="approval">
            {editable ? (
              <input id={`ap-${key}`} type="checkbox" checked={f.approved} onChange={(e) => set("approved", e.target.checked, true)} />
            ) : (
              <span className="ro">{f.approved ? "Yes" : "No"}</span>
            )}
            <span className="muted small">
              {approvedAt ? `last changed ${fmtDateTime(approvedAt)}` : f.approved ? "imported" : ""}
            </span>
          </div>
        </div>
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
          {editable && <button onClick={copy}>{copied ? "Copied" : "Copy Venmo note"}</button>}
          {canVenmo && <VenmoBadge handle={venmoHandle} amount={outstanding} note={venmoNote(period)} />}
          {editable && <SaveStatus status={statuses[key]} />}
          {editable && (
            <button
              type="button"
              className="danger small"
              onClick={() => {
                if (!window.confirm(`Clear all payment details for ${fmtDate(period.start)} – ${fmtDate(period.end)}?`)) return;
                const blank = { homepay_earnings: "", homepay_net: "", homepay_date: "", personal_paid: "", personal_date: "", route: "", notes: "", approved: false };
                setF(blank);
                queue(key, { period_start: period.start, ...blank });
                flush(key);
              }}
            >
              Clear payment
            </button>
          )}
        </div>
      </div>
    </details>
  );
}
