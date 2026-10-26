"use client";

import { useState } from "react";
import { useSaver } from "@/lib/useSaver";
import type { Settings } from "@/lib/calc";
import SaveStatus from "./SaveStatus";

export default function SettingsForm({ initial, editable }: { initial: Settings; editable: boolean }) {
  const [s, setS] = useState(initial);
  const { statuses, queue, flush } = useSaver<Settings>("/api/settings");

  const patch = (p: Partial<Settings>) => {
    const next = { ...s, ...p };
    setS(next);
    queue("settings", next);
  };

  return (
    <div>
      <div className="field">
        <label htmlFor="rate">Overtime rate ($ per hour)</label>
        {editable ? (
          <input id="rate" type="number" inputMode="decimal" step="0.01" min={0} value={s.otRate} onFocus={(e) => e.target.select()}
            onChange={(e) => patch({ otRate: Math.max(Number(e.target.value) || 0, 0) })} onBlur={() => flush("settings")} />
        ) : (
          <span className="ro">${s.otRate.toFixed(2)}</span>
        )}
      </div>
      <div className="field">
        <label htmlFor="thr">Overtime after (hours per pay period)</label>
        {editable ? (
          <input id="thr" type="number" inputMode="decimal" step="0.25" min={0} value={s.otThreshold} onFocus={(e) => e.target.select()}
            onChange={(e) => patch({ otThreshold: Math.max(Number(e.target.value) || 0, 0) })} onBlur={() => flush("settings")} />
        ) : (
          <span className="ro">{s.otThreshold}</span>
        )}
      </div>
      {editable && <div className="savebar"><SaveStatus status={statuses.settings} /></div>}
    </div>
  );
}
