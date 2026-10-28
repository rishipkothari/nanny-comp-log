"use client";

import { useEffect, useRef, useState } from "react";
import { fmtDate, fmtDateTime, hrs, money, periodStatus, venmoNote, type Period } from "@/lib/calc";
import { useSaver } from "@/lib/useSaver";
import Modal from "./Modal";
import SaveStatus from "./SaveStatus";
import StatusBadges from "./StatusBadges";
import VenmoBadge from "./VenmoBadge";

const ROUTES = ["Venmo", "Cash", "Zelle"];

type Props = { period: Period; editable: boolean; today: string; venmoHandle: string };

/** One pay period's payment: the form state, autosave, and the status it implies. */
function usePayment(period: Period, today: string) {
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
  const key = period.start;

  const set = (k: keyof typeof f, v: string | boolean, now = false) => {
    const next = { ...f, [k]: v };
    setF(next);
    queue(key, { period_start: period.start, ...next });
    if (now) flush(key);
  };
  const blur = () => flush(key);
  const clear = () => {
    const blank = { homepay_earnings: "", homepay_net: "", homepay_date: "", personal_paid: "", personal_date: "", route: "", notes: "", approved: false };
    setF(blank);
    queue(key, { period_start: period.start, ...blank });
    flush(key);
  };

  const net = Number(f.homepay_net) || 0;
  const paid = Number(f.personal_paid) || 0;
  const status = periodStatus(
    { end: period.end, total: period.total, homepayNet: net, personalDue: period.personalDue, personalPaid: paid, approved: f.approved },
    today,
  );
  return { f, set, blur, clear, approvedAt, saveStatus: statuses[key], net, paid, status };
}

type Payment = ReturnType<typeof usePayment>;

/** A short summary card; tapping it (or Detail / Edit) opens the payment popup. */
export default function PaymentCard({ period, editable, today, venmoHandle, defaultOpen = false }: Props & { defaultOpen?: boolean }) {
  const pay = usePayment(period, today);
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultOpen) ref.current?.scrollIntoView({ block: "start" });
  }, [defaultOpen]);

  return (
    <>
      <div ref={ref} id={`p-${period.start}`} className="card pay" onClick={() => setOpen(true)}>
        <div className="paytop">
          <div>
            <div>{fmtDate(period.start)} – {fmtDate(period.end)}</div>
            <div className="sub">{hrs(period.total)} h · personal due {money(period.personalDue)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div>{money(pay.net + pay.paid)}</div>
            <StatusBadges status={pay.status} />
          </div>
        </div>
        <div className="payfoot small">
          <button type="button" className="linkish">{editable ? "Edit →" : "Detail →"}</button>
        </div>
      </div>
      <PaymentDialog open={open} onClose={() => setOpen(false)} period={period} pay={pay} editable={editable} today={today} venmoHandle={venmoHandle} />
    </>
  );
}

/** One row of the payments log; tapping it opens the payment popup. */
export function PaymentTableRow({ period, editable, today, venmoHandle }: Props) {
  const pay = usePayment(period, today);
  const [open, setOpen] = useState(false);
  const { f, status } = pay;
  const owed = status.outstanding;
  const amount = (v: string) => (v === "" ? "—" : money(Number(v)));

  return (
    <tr className="tap" onClick={() => setOpen(true)}>
      <td>{fmtDate(period.start)} – {fmtDate(period.end)}</td>
      <td><StatusBadges status={status} /></td>
      <td>{f.approved ? "Yes" : "No"}</td>
      <td>{hrs(period.total)}</td>
      <td>{amount(f.homepay_earnings)}</td>
      <td>{amount(f.homepay_net)}</td>
      <td>{f.homepay_date ? fmtDate(f.homepay_date) : "—"}</td>
      <td>{money(period.personalDue)}</td>
      <td>{amount(f.personal_paid)}</td>
      <td>{f.personal_date ? fmtDate(f.personal_date) : "—"}</td>
      <td>{f.route || "—"}</td>
      <td className={Math.abs(owed) >= 0.005 ? "ot" : ""}>{money(owed)}</td>
      <td><b>{money(pay.net + pay.paid)}</b></td>
      <td className="l">
        {f.notes}
        <PaymentDialog open={open} onClose={() => setOpen(false)} period={period} pay={pay} editable={editable} today={today} venmoHandle={venmoHandle} />
      </td>
    </tr>
  );
}

function PaymentDialog({ open, onClose, period, pay, editable, today, venmoHandle }: Props & { open: boolean; onClose: () => void; pay: Payment }) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="head">
        <div>
          <div>{fmtDate(period.start)} – {fmtDate(period.end)}</div>
          <div className="muted small">Pay period {period.id} · {editable ? "edit payment" : "payment"}</div>
        </div>
        <div className="headright">
          <StatusBadges status={pay.status} />
          <button type="button" className="small" onClick={onClose} aria-label="Close">✕</button>
        </div>
      </div>
      <PaymentForm period={period} pay={pay} editable={editable} today={today} venmoHandle={venmoHandle} />
    </Modal>
  );
}

function PaymentForm({ period, pay, editable, today, venmoHandle }: Props & { pay: Payment }) {
  const { f, set, blur, approvedAt, net, paid, status } = pay;
  const [copied, setCopied] = useState(false);
  const key = period.start;
  const outstanding = status.outstanding;
  // always offered in admin mode; the amount is prefilled only while personal pay is owed
  const owed = outstanding > 0.005 ? outstanding : null;

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

  /** Worked out from hours and other fields, so never editable. */
  const calc = (label: string, value: string) => (
    <div className="field calc">
      <label>{label}</label>
      <span className="ro">{value}</span>
    </div>
  );

  return (
    <div className="body">
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
      {calc("Personal comp due", money(period.personalDue))}
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
      {calc("Total paid", money(net + paid))}
      {editable && (
        <div className="savebar">
          <button onClick={copy}>{copied ? "Copied" : "Copy Venmo note"}</button>
          {venmoHandle && <VenmoBadge handle={venmoHandle} amount={owed} note={venmoNote(period)} />}
          {venmoHandle && owed === null && <span className="muted small">no amount owed</span>}
          <SaveStatus status={pay.saveStatus} />
          <button
            type="button"
            className="danger small"
            onClick={() => {
              if (window.confirm(`Clear all payment details for ${fmtDate(period.start)} – ${fmtDate(period.end)}?`)) pay.clear();
            }}
          >
            Clear payment
          </button>
        </div>
      )}
    </div>
  );
}
