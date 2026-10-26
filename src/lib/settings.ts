import type { Settings } from "./calc";

/**
 * Settings live in a key/value table (value is jsonb), so a new setting is one entry here
 * plus a field on `Settings` -- no schema change. Lists with their own lifecycle
 * (calendars) get their own tables instead.
 */
type Defs = { [K in keyof Settings]: { key: string; parse: (v: unknown) => Settings[K] | undefined } };

const nonNegative = (v: unknown) => {
  const n = typeof v === "string" && v.trim() === "" ? NaN : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

/** A Venmo username, with or without the leading @. Empty means "not set". */
const handle = (v: unknown) => {
  const s = String(v ?? "").trim().replace(/^@/, "");
  return s === "" || /^[A-Za-z0-9_-]{1,40}$/.test(s) ? s : undefined;
};

/** Free text handed to schedule deduction as notes about how the calendar is written. */
const notes = (v: unknown) => (typeof v === "string" ? v.slice(0, 2000) : undefined);

export const SETTING_DEFS: Defs = {
  otRate: { key: "ot_rate", parse: nonNegative },
  otThreshold: { key: "ot_threshold", parse: nonNegative },
  venmoHandle: { key: "venmo_handle", parse: handle },
  scheduleHints: { key: "schedule_hints", parse: notes },
};

export const SETTING_FIELDS = Object.keys(SETTING_DEFS) as (keyof Settings)[];
