"use client";

import { useState } from "react";
import { dayHours, type DayRow } from "@/lib/calc";

type Props = { initial: DayRow };

function Stepper({ label, value, onChange, step = 1, money = false }: { label: string; value: number; onChange: (n: number) => void; step?: number; money?: boolean }) {
  const set = (n: number) => onChange(Math.max(0, Math.round(n * 100) / 100));
  return (
    <div className="field">
      <label>{label}</label>
      <div className="stepper">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => set(Number(e.target.value))}
          aria-label={label}
        />
        <button type="button" onClick={() => set(value - step)} aria-label={`Decrease ${label}`}>−</button>
        <button type="button" onClick={() => set(value + step)} aria-label={`Increase ${label}`}>+</button>
      </div>
      {money ? null : null}
    </div>
  );
}

export default function DayForm({ initial }: Props) {
  const [d, setD] = useState<DayRow>(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const patch = (p: Partial<DayRow>) => {
    setD((prev) => ({ ...prev, ...p }));
    setState("idle");
  };

  async function save() {
    setState("saving");
    try {
      const res = await fetch("/api/day", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(d) });
      setState(res.ok ? "saved" : "error");
    } catch {
      setState("error");
    }
  }

  const total = dayHours(d) + d.vacation + d.sick;

  return (
    <div>
      <Stepper label="Hours" value={d.hours} onChange={(n) => patch({ hours: Math.round(n) })} />
      <Stepper label="Minutes" value={d.minutes} step={15} onChange={(n) => patch({ minutes: Math.round(n) })} />
      <Stepper label="Stipend ($)" value={d.stipend} step={5} onChange={(n) => patch({ stipend: n })} money />
      <Stepper label="Expenses ($)" value={d.expenses} step={1} onChange={(n) => patch({ expenses: n })} money />
      <Stepper label="Vacation hours" value={d.vacation} onChange={(n) => patch({ vacation: n })} />
      <Stepper label="Sick hours" value={d.sick} onChange={(n) => patch({ sick: n })} />
      <div className="field">
        <span className="l">Total hours</span>
        <span className="total">{total.toFixed(2)}</span>
      </div>
      <div className="field">
        <label htmlFor="holiday">Holiday</label>
        <input id="holiday" type="checkbox" checked={d.holiday} onChange={(e) => patch({ holiday: e.target.checked })} style={{ width: 22, height: 22 }} />
      </div>
      <div className="field">
        <label htmlFor="notes">Notes</label>
        <input id="notes" type="text" value={d.notes} onChange={(e) => patch({ notes: e.target.value })} />
      </div>
      <div className="savebar">
        <button className="primary" onClick={save} disabled={state === "saving"}>
          {state === "saving" ? "Saving…" : "Save"}
        </button>
        {state === "saved" && <span className="saved">Saved</span>}
        {state === "error" && <span className="err">Couldn’t save</span>}
      </div>
    </div>
  );
}
