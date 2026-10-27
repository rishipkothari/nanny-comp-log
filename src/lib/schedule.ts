import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { addDays, fmtDow, type ScheduleEffort, type ScheduleModel, totalHours, vacationHours, sickHours, holidayHours, workedHours } from "./calc";
import { ensureSchema as ensureCalendarSchema, getScheduleEvents, type DayEvent } from "./calendar";
import { getDayRange, getSettings, sql } from "./db";

/* ---------- types ---------- */

/**
 * Where a block boundary came from. Only "stated" boundaries (the nanny's hours written out)
 * make a day's total trustworthy enough to offer for the timesheet.
 */
export type Basis = "stated" | "event" | "assumed";

export type Block = { start: string; end: string; label: string; start_basis: Basis; end_basis: Basis; sources: string[] };

export type ScheduleDay = {
  date: string;
  working: boolean;
  blocks: Block[];
  /** Null when any boundary is anchored to another event or assumed: no hour total is suggested then. */
  total_minutes: number | null;
  confidence: "high" | "medium" | "low";
  explanation: string;
  created_at: string;
  /** DEBUG: which model and effort produced this day. */
  model: string;
};

/** Bump when the prompt or schema changes so cached days are re-deduced. */
const PROMPT_VERSION = 1;
const BASES: Basis[] = ["stated", "event", "assumed"];
const CONFIDENCE = ["high", "medium", "low"] as const;

export const hasApiKey = () => !!process.env.ANTHROPIC_API_KEY;

/* ---------- storage ---------- */

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await ensureCalendarSchema();
    await sql`CREATE TABLE IF NOT EXISTS schedule_days (
      date date PRIMARY KEY,
      working boolean NOT NULL,
      blocks jsonb NOT NULL,
      total_minutes integer,
      confidence text NOT NULL,
      explanation text NOT NULL DEFAULT '',
      input_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`ALTER TABLE schedule_days ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT ''`;
  })().catch((e) => {
    schemaReady = null;
    throw e;
  });
  return schemaReady;
}

type Stored = ScheduleDay & { input_hash: string };

async function readDays(from: string, to: string): Promise<Stored[]> {
  await ensureSchema();
  const rows = await sql`SELECT date::text AS date, working, blocks, total_minutes, confidence, explanation, input_hash, model,
    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
    FROM schedule_days WHERE date BETWEEN ${from} AND ${to} ORDER BY date`;
  return rows.map((r) => ({
    date: r.date as string,
    working: r.working as boolean,
    blocks: r.blocks as Block[],
    total_minutes: r.total_minutes == null ? null : Number(r.total_minutes),
    confidence: r.confidence as ScheduleDay["confidence"],
    explanation: r.explanation as string,
    created_at: r.created_at as string,
    input_hash: r.input_hash as string,
    model: r.model as string,
  }));
}

/** Deduced days between from and to (inclusive), without the cache bookkeeping. */
export async function getScheduleDays(from: string, to: string): Promise<ScheduleDay[]> {
  return (await readDays(from, to)).map(({ input_hash: _, ...d }) => d);
}

/* ---------- input ---------- */

const hhmm = (local: string) => local.slice(11, 16);

/** The dates an event covers: all-day ends are exclusive, a timed event ending at midnight stops the day before. */
function coveredDays(e: DayEvent): string[] {
  const first = e.start.slice(0, 10);
  let last = e.end.slice(0, 10);
  if (e.end > e.start && (e.all_day || e.end.slice(11) === "00:00:00")) last = addDays(last, -1);
  if (last < first) last = first;
  const out: string[] = [];
  for (let d = first; d <= last && out.length < 60; d = addDays(d, 1)) out.push(d);
  return out;
}

/** What one event looks like to the model; ids are only meaningful inside one request. */
function describe(e: DayEvent) {
  const days = coveredDays(e);
  return e.all_day
    ? { id: e.id, all_day: true, first_date: days[0], last_date: days[days.length - 1], title: e.title, location: e.location || undefined, calendar: e.calendar }
    : { id: e.id, all_day: false, start: `${e.start.slice(0, 10)} ${hhmm(e.start)}`, end: `${e.end.slice(0, 10)} ${hhmm(e.end)}`, title: e.title, location: e.location || undefined, calendar: e.calendar };
}

/** A day's cache key: its own events, the household notes, the model settings, and the prompt version. */
function dayHash(date: string, events: DayEvent[], hints: string, model: string): string {
  const mine = events.filter((e) => coveredDays(e).includes(date)).map((e) => [e.title, e.location, e.all_day, e.start, e.end]);
  return createHash("sha256").update(JSON.stringify([PROMPT_VERSION, model, hints, mine])).digest("hex");
}

/* ---------- the model call ---------- */

const SYSTEM = `You work out a household employee's (nanny's) working schedule from a family calendar.

You get calendar events for a three-week window, the hours actually logged on the timesheet for some of those days, and notes from the household about how they write their calendar. Return the nanny's working schedule for each target date only; the other dates are context for spotting patterns.

How to read the calendar:
- Entries are written by busy people and are imperfect. Working times are often typed into a title rather than set as the event's time (for example "AS 8-5:30", "7:30-12, 3-6", "Anat til 6"), am/pm is usually left out, and there are abbreviations and typos. Read times the way a person in the household would: working hours are daytime, so "8-5:30" means 08:00-17:30 and "7:30-12, 3-6" means 07:30-12:00 and 15:00-18:00.
- A day can have several separate blocks (a split shift). Never fill a gap the calendar leaves open.
- Tell statements of the nanny's working time apart from other events (school drop-off or pickup, bedtime, appointments, activities). Those other events can bound working time, e.g. "until pickup" ends a block at the pickup time.
- Days off, vacation, sick days, holidays, or "no nanny" mean no work that day; mention which in the explanation.
- When a target date has nothing that indicates work, the nanny is not working that day. Use patterns from the other weeks only to resolve what is ambiguous on a date that does have an entry, such as a missing end time.
- Logged hours are daily totals from the timesheet, not times of day. Use them to check how written schedules usually translate into hours.

For every block boundary, say where its time came from:
- "stated": the time is written out as the nanny's working time (in a title, or as the time of an event that is itself the nanny's shift).
- "event": the time is taken from a different event, such as a pickup, drop-off or bedtime.
- "assumed": the time is inferred from patterns, typical days, or logged hours.

Times are 24-hour "HH:MM" wall-clock times, exactly as the calendar shows them. List in event_ids the ids of the events each block is based on. Keep each explanation to one plain sentence that names any assumption you made. Set confidence to "low" whenever you had to guess.`;

const BASIS_SCHEMA = { type: "string", enum: BASES };
const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["days"],
  properties: {
    days: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "working", "blocks", "confidence", "explanation"],
        properties: {
          date: { type: "string", description: "YYYY-MM-DD, one of the target dates" },
          working: { type: "boolean" },
          blocks: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["start", "end", "label", "start_basis", "end_basis", "event_ids"],
              properties: {
                start: { type: "string", description: "HH:MM, 24-hour" },
                end: { type: "string", description: "HH:MM, 24-hour" },
                label: { type: "string", description: "A few words, e.g. 'Morning' or 'After school'" },
                start_basis: BASIS_SCHEMA,
                end_basis: BASIS_SCHEMA,
                event_ids: { type: "array", items: { type: "integer" } },
              },
            },
          },
          confidence: { type: "string", enum: [...CONFIDENCE] },
          explanation: { type: "string" },
        },
      },
    },
  },
};

type RawBlock = { start: string; end: string; label: string; start_basis: Basis; end_basis: Basis; event_ids: number[] };
type RawDay = { date: string; working: boolean; blocks: RawBlock[]; confidence: ScheduleDay["confidence"]; explanation: string };

const toMinutes = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return Number(m[2]) < 60 && v <= 24 * 60 ? v : null;
};
const fromMinutes = (v: number) => `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
const weaker = (a: Basis, b: Basis): Basis => (BASES.indexOf(a) > BASES.indexOf(b) ? a : b);

/** Checks the model's blocks: valid times, start before end, sorted, overlaps merged. */
function cleanDay(raw: RawDay, titles: Map<number, string>): Omit<ScheduleDay, "created_at" | "model"> {
  const blocks: (Block & { s: number; e: number })[] = [];
  for (const b of raw.blocks ?? []) {
    const s = toMinutes(b.start);
    const e = toMinutes(b.end);
    if (s === null || e === null || e <= s) continue;
    const sources = [...new Set((b.event_ids ?? []).map((id) => titles.get(id)).filter((t): t is string => !!t))];
    const start_basis = BASES.includes(b.start_basis) ? b.start_basis : "assumed";
    const end_basis = BASES.includes(b.end_basis) ? b.end_basis : "assumed";
    blocks.push({ s, e, start: fromMinutes(s), end: fromMinutes(e), label: String(b.label ?? "").slice(0, 60), start_basis, end_basis, sources });
  }
  blocks.sort((a, b) => a.s - b.s);
  const merged: typeof blocks = [];
  for (const b of blocks) {
    const last = merged[merged.length - 1];
    if (last && b.s <= last.e) {
      if (b.e > last.e) {
        last.e = b.e;
        last.end = b.end;
        last.end_basis = b.end_basis;
      }
      last.start_basis = weaker(last.start_basis, b.start_basis);
      last.sources = [...new Set([...last.sources, ...b.sources])];
    } else merged.push({ ...b });
  }
  const working = raw.working && merged.length > 0;
  const out = working ? merged.map(({ s: _s, e: _e, ...b }) => b) : [];
  const reliable = out.every((b) => b.start_basis === "stated" && b.end_basis === "stated");
  return {
    date: raw.date,
    working,
    blocks: out,
    total_minutes: !working ? 0 : reliable ? merged.reduce((n, b) => n + b.e - b.s, 0) : null,
    confidence: CONFIDENCE.includes(raw.confidence) ? raw.confidence : "low",
    explanation: String(raw.explanation ?? "").slice(0, 500),
  };
}

async function askClaude(input: unknown, model: ScheduleModel, effort: ScheduleEffort): Promise<RawDay[]> {
  const client = new Anthropic();
  // Opus and Sonnet re-run a declined request on another model; Haiku ignores the setting.
  const res = await client.beta.messages.create({
    model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(input, null, 1) }],
  });
  if (res.stop_reason === "refusal") throw new Error("Claude declined to read this calendar");
  if (res.stop_reason === "max_tokens") throw new Error("Claude's answer was cut off; try again");
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  try {
    return (JSON.parse(text) as { days: RawDay[] }).days ?? [];
  } catch {
    throw new Error("Claude returned an answer that could not be read; try again");
  }
}

/* ---------- deduction ---------- */

export type DeduceResult = { days: ScheduleDay[]; cached: boolean };

/**
 * Deduces the 7 days of the pay period starting at `start`, with the week before and after as
 * context. Days whose events and notes are unchanged keep their stored answer unless `force`.
 */
export async function deduceSchedule(start: string, force: boolean): Promise<DeduceResult> {
  await ensureSchema();
  const end = addDays(start, 6);
  const from = addDays(start, -7);
  const to = addDays(start, 13);
  const targets = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const [events, logged, settings, stored] = await Promise.all([getScheduleEvents(from, to), getDayRange(from, to), getSettings(), readDays(start, end)]);
  const modelTag = `${settings.scheduleModel}/${settings.scheduleEffort}`;
  const hashes = new Map(targets.map((d) => [d, dayHash(d, events, settings.scheduleHints, modelTag)]));
  const storedByDate = new Map(stored.map((d) => [d.date, d]));
  if (!force && targets.every((d) => storedByDate.get(d)?.input_hash === hashes.get(d))) {
    return { days: stored.map(({ input_hash: _, ...d }) => d), cached: true };
  }

  const dates = Array.from({ length: 21 }, (_, i) => addDays(from, i));
  const input = {
    household_notes: settings.scheduleHints.trim() || "(none)",
    target_dates: targets.map((d) => `${d} (${fmtDow(d)})`),
    context_dates: `${from} to ${addDays(start, -1)} and ${addDays(end, 1)} to ${to}`,
    events: events.map(describe),
    logged_hours: logged
      .filter((d) => totalHours(d) > 0)
      .map((d) => ({
        date: `${d.date} (${fmtDow(d.date)})`,
        worked: +workedHours(d).toFixed(2),
        vacation: +vacationHours(d).toFixed(2) || undefined,
        sick: +sickHours(d).toFixed(2) || undefined,
        holiday: +holidayHours(d).toFixed(2) || undefined,
      })),
    weekdays: Object.fromEntries(dates.map((d) => [d, fmtDow(d)])),
  };

  const raw = await askClaude(input, settings.scheduleModel, settings.scheduleEffort);
  const titles = new Map(events.map((e) => [e.id, e.title]));
  const byDate = new Map(raw.filter((d) => hashes.has(d.date)).map((d) => [d.date, cleanDay(d, titles)]));
  const days: Omit<ScheduleDay, "created_at" | "model">[] = targets.map(
    (date) =>
      byDate.get(date) ?? { date, working: false, blocks: [], total_minutes: 0, confidence: "low" as const, explanation: "No answer was returned for this day." },
  );

  await sql.transaction(
    days.map(
      (d) => sql`INSERT INTO schedule_days (date, working, blocks, total_minutes, confidence, explanation, input_hash, model, created_at)
        VALUES (${d.date}, ${d.working}, ${JSON.stringify(d.blocks)}::jsonb, ${d.total_minutes}, ${d.confidence}, ${d.explanation}, ${hashes.get(d.date)!}, ${modelTag}, now())
        ON CONFLICT (date) DO UPDATE SET working = EXCLUDED.working, blocks = EXCLUDED.blocks, total_minutes = EXCLUDED.total_minutes,
          confidence = EXCLUDED.confidence, explanation = EXCLUDED.explanation, input_hash = EXCLUDED.input_hash, model = EXCLUDED.model, created_at = now()`,
    ),
  );
  return { days: await getScheduleDays(start, end), cached: false };
}

/** Sets a day's working hours to its scheduled total; other timesheet fields are kept. */
export async function applyScheduledHours(date: string): Promise<{ ok: boolean; error?: string }> {
  await ensureSchema();
  const rows = await sql`SELECT total_minutes FROM schedule_days WHERE date = ${date}`;
  const total = rows[0]?.total_minutes;
  if (total == null) return { ok: false, error: "no scheduled total for this day" };
  const minutes = Math.min(Number(total), 99 * 60 + 59);
  await sql`INSERT INTO days (date, hours, minutes) VALUES (${date}, ${Math.floor(minutes / 60)}, ${minutes % 60})
    ON CONFLICT (date) DO UPDATE SET hours = EXCLUDED.hours, minutes = EXCLUDED.minutes`;
  return { ok: true };
}

/** Minutes across days that have a total, plus how many working days have none. */
export function scheduledTotal(days: ScheduleDay[]): { minutes: number; open: number; working: number } {
  let minutes = 0;
  let open = 0;
  for (const d of days) {
    if (!d.working) continue;
    if (d.total_minutes === null) open++;
    else minutes += d.total_minutes;
  }
  return { minutes, open, working: days.filter((d) => d.working).length };
}
