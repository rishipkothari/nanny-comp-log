"use client";

import { useState } from "react";
import { totalHours, type DayRow } from "@/lib/calc";
import { useSaver } from "@/lib/useSaver";
import SaveStatus from "./SaveStatus";
import TimeInput from "./TimeInput";

export default function DayForm({ initial }: { initial: DayRow }) {
  const [d, setD] = useState<DayRow>(initial);
  const { statuses, queue, flush } = useSaver<DayRow>("/api/day");
  const key = d.date;

  const patch = (p: Partial<DayRow>) => {
    const next = { ...d, ...p };
    setD(next);
    queue(key, next);
  };
  const blur = () => flush(key);

  return (
    <div>
      <TimeInput label="Working" h={d.wh} m={d.wm} onChange={(wh, wm) => patch({ wh, wm })} onBlur={blur} />
      <TimeInput label="Vacation" h={d.vh} m={d.vm} onChange={(vh, vm) => patch({ vh, vm })} onBlur={blur} />
      <TimeInput label="Sick" h={d.sh} m={d.sm} onChange={(sh, sm) => patch({ sh, sm })} onBlur={blur} />
      <TimeInput label="Holiday" h={d.hh} m={d.hm} onChange={(hh, hm) => patch({ hh, hm })} onBlur={blur} />

      <div className="field">
        <label htmlFor="stipend">Stipend ($)</label>
        <input id="stipend" type="number" inputMode="decimal" step="0.01" min={0} value={d.stipend} onFocus={(e) => e.target.select()}
          onChange={(e) => patch({ stipend: Math.max(Number(e.target.value) || 0, 0) })} onBlur={blur} />
      </div>
      <div className="field">
        <label htmlFor="expenses">Expenses ($)</label>
        <input id="expenses" type="number" inputMode="decimal" step="0.01" min={0} value={d.expenses} onFocus={(e) => e.target.select()}
          onChange={(e) => patch({ expenses: Math.max(Number(e.target.value) || 0, 0) })} onBlur={blur} />
      </div>
      <div className="field">
        <label htmlFor="notes">Notes</label>
        <input id="notes" type="text" value={d.notes} onChange={(e) => patch({ notes: e.target.value })} onBlur={blur} />
      </div>
      <div className="field">
        <span className="l">Total hours</span>
        <span className="total">{totalHours(d).toFixed(2)}</span>
      </div>
      <div className="savebar">
        <SaveStatus status={statuses[key]} />
      </div>
    </div>
  );
}
