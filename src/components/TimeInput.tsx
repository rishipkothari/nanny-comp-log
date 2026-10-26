"use client";

type Props = {
  label: string;
  h: number;
  m: number;
  onChange: (h: number, m: number) => void;
  onBlur?: () => void;
};

const clamp = (n: number, max: number) => Math.min(Math.max(Number.isFinite(n) ? Math.round(n) : 0, 0), max);

/** Hours and minutes side by side. Buttons step hours by 1 and minutes by 5; typing accepts any minute 0-59. */
export default function TimeInput({ label, h, m, onChange, onBlur }: Props) {
  const minutesUp = () => {
    const next = (Math.floor(m / 5) + 1) * 5;
    if (next >= 60) onChange(clamp(h + 1, 99), 0);
    else onChange(h, next);
  };
  const minutesDown = () => {
    const prev = Math.ceil(m / 5) * 5 - 5;
    if (prev >= 0) onChange(h, prev);
    else if (h > 0) onChange(h - 1, 55);
    else onChange(0, 0);
  };

  return (
    <div className="time">
      <div className="tlabel">{label}</div>
      <div className="tpair">
        <div className="stepper">
          <button type="button" onClick={() => onChange(clamp(h - 1, 99), m)} aria-label={`${label} hours down`}>−</button>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            value={h}
            onFocus={(e) => e.target.select()}
            onChange={(e) => onChange(clamp(Number(e.target.value), 99), m)}
            onBlur={onBlur}
            aria-label={`${label} hours`}
          />
          <button type="button" onClick={() => onChange(clamp(h + 1, 99), m)} aria-label={`${label} hours up`}>+</button>
          <span className="unit">hrs</span>
        </div>
        <div className="stepper">
          <button type="button" onClick={minutesDown} aria-label={`${label} minutes down`}>−</button>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            value={m}
            onFocus={(e) => e.target.select()}
            onChange={(e) => onChange(h, clamp(Number(e.target.value), 59))}
            onBlur={onBlur}
            aria-label={`${label} minutes`}
          />
          <button type="button" onClick={minutesUp} aria-label={`${label} minutes up`}>+</button>
          <span className="unit">min</span>
        </div>
      </div>
    </div>
  );
}
