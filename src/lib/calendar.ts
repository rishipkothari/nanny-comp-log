import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import ICAL from "ical.js";
import { addDays } from "./calc";
import { sql } from "./db";

/* ---------- types ---------- */

export type Calendar = {
  id: number;
  label: string;
  color: string;
  enabled: boolean;
  last_synced: string | null;
  last_error: string | null;
  /** Subscription URLs are credentials (secret iCal addresses), so only a masked form leaves the server. */
  url_masked: string;
};

/** start/end are wall-clock times in the zone the event was created in ("2026-10-26T09:30:00"), never shifted. */
export type DayEvent = {
  id: number;
  title: string;
  location: string;
  all_day: boolean;
  start: string;
  end: string;
  calendar_id: number;
  calendar: string;
  color: string;
};

const ISO = `'YYYY-MM-DD"T"HH24:MI:SS"Z"'`;
const LOCAL = `'YYYY-MM-DD"T"HH24:MI:SS'`;
const STALE_MINUTES = 15;
export const WINDOW_BACK_DAYS = 60;
export const WINDOW_AHEAD_DAYS = 60;
const DEFAULT_TZ = "America/New_York";
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_EVENTS = 5000;
const MAX_ITERATIONS = 20000;

/* ---------- url handling ---------- */

export function normalizeUrl(input: string): string | null {
  let s = input.trim();
  if (/^webcals?:\/\//i.test(s)) s = s.replace(/^webcals?:/i, "https:");
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/…${url.slice(-4)}`;
  } catch {
    return "…";
  }
}

function isPrivateAddress(addr: string): boolean {
  const mapped = addr.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) addr = mapped[1];
  if (isIP(addr) === 4) {
    const [a, b] = addr.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
    );
  }
  const v6 = addr.toLowerCase();
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || /^fe[89ab]/.test(v6);
}

async function assertPublicHost(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error("calendar address is not a public host");
}

/** Fetch with a timeout and size cap; redirects are followed manually so each hop is re-checked. */
async function fetchFeed(start: string): Promise<string> {
  let url = new URL(start);
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicHost(url);
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10000), headers: { accept: "text/calendar, */*" }, cache: "no-store" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("redirect without location");
      const next = new URL(loc, url);
      if (next.protocol !== "https:" && next.protocol !== "http:") throw new Error("bad redirect");
      url = next;
      continue;
    }
    if (!res.ok) throw new Error(`feed returned ${res.status}`);
    const len = Number(res.headers.get("content-length"));
    if (len > MAX_BYTES) throw new Error("feed too large");
    const reader = res.body?.getReader();
    if (!reader) throw new Error("empty feed");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new Error("feed too large");
      }
      chunks.push(value);
    }
    return new TextDecoder().decode(Buffer.concat(chunks));
  }
  throw new Error("too many redirects");
}

/* ---------- parsing ---------- */

type Row = {
  uid: string; start_at: string; end_at: string; start_local: string; end_local: string;
  all_day: boolean; title: string; location: string;
};

const p2 = (n: number) => String(n).padStart(2, "0");

/** Wall-clock fields of an instant in an IANA zone, as "YYYY-MM-DDTHH:MM:SS". */
function wallClock(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(d);
  const v = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${v("year")}-${v("month")}-${v("day")}T${v("hour")}:${v("minute")}:${v("second")}`;
}

/**
 * The time as written in the zone the event was created in. A TZID or floating value already carries
 * its own wall-clock fields; a UTC value is shown in the calendar's own zone (X-WR-TIMEZONE).
 */
function toLocal(t: ICAL.Time, calendarTz: string): string {
  if (t.isDate) return `${t.year}-${p2(t.month)}-${p2(t.day)}T00:00:00`;
  const tzid = t.zone?.tzid;
  if (tzid === "UTC" || tzid === "Z") return wallClock(t.toJSDate(), calendarTz);
  return `${t.year}-${p2(t.month)}-${p2(t.day)}T${p2(t.hour)}:${p2(t.minute)}:${p2(t.second)}`;
}

function calendarZone(root: ICAL.Component): string {
  const name = String(root.getFirstPropertyValue("x-wr-timezone") ?? "").trim();
  if (!name) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name });
    return name;
  } catch {
    return DEFAULT_TZ;
  }
}

/** All-day values are stored as UTC midnight of the calendar date (end exclusive); timed values as the real instant. */
function toInstant(t: ICAL.Time): Date {
  return t.isDate ? new Date(Date.UTC(t.year, t.month - 1, t.day)) : t.toJSDate();
}

export function parseEvents(text: string, from: Date, to: Date): Row[] {
  const root = new ICAL.Component(ICAL.parse(text));
  const calendarTz = calendarZone(root);
  ICAL.TimezoneService.reset();
  for (const tz of root.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(tz);

  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Component[] = [];
  const loose: ICAL.Event[] = [];
  for (const v of root.getAllSubcomponents("vevent")) {
    if (v.hasProperty("recurrence-id")) exceptions.push(v);
    else {
      const ev = new ICAL.Event(v);
      if (ev.isRecurring()) masters.set(ev.uid, ev);
      else loose.push(ev);
    }
  }
  for (const v of exceptions) {
    const ev = new ICAL.Event(v);
    const master = masters.get(ev.uid);
    if (master) master.relateException(v);
    else loose.push(ev); // an invited single instance whose series isn't in the feed
  }

  const out = new Map<string, Row>();
  const add = (uid: string, start: ICAL.Time, end: ICAL.Time, item: ICAL.Event) => {
    const status = String(item.component.getFirstPropertyValue("status") ?? "").toUpperCase();
    if (status === "CANCELLED") return;
    const s = toInstant(start);
    let e = toInstant(end);
    if (e < s) e = s;
    if (e < from || s > to) return;
    const row: Row = {
      uid, start_at: s.toISOString(), end_at: e.toISOString(), all_day: start.isDate,
      start_local: toLocal(start, calendarTz), end_local: toLocal(end, calendarTz),
      title: (item.summary || "").trim() || "(no title)", location: (item.location || "").trim(),
    };
    out.set(`${uid}|${row.start_at}`, row);
  };

  for (const ev of loose) add(ev.uid, ev.startDate, ev.endDate, ev);
  const toTime = ICAL.Time.fromJSDate(to, true);
  for (const master of masters.values()) {
    const it = master.iterator();
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const next = it.next();
      if (!next || next.compare(toTime) > 0) break;
      const d = master.getOccurrenceDetails(next);
      add(master.uid, d.startDate, d.endDate, d.item);
    }
  }
  return [...out.values()].sort((a, b) => (a.start_at < b.start_at ? -1 : 1)).slice(0, MAX_EVENTS);
}

/* ---------- storage + sync ---------- */

let schemaReady: Promise<void> | null = null;

/** Adds the wall-clock columns on first use so the code can ship before db:setup has been run. */
function ensureSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await sql.query(`ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS start_local timestamp`);
    await sql.query(`ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS end_local timestamp`);
    // Rows from before the columns existed get a best guess now and are re-fetched for the real zone.
    const filled = await sql.query(
      `UPDATE calendar_events SET
         start_local = CASE WHEN all_day THEN start_at AT TIME ZONE 'UTC' ELSE start_at AT TIME ZONE '${DEFAULT_TZ}' END,
         end_local = CASE WHEN all_day THEN end_at AT TIME ZONE 'UTC' ELSE end_at AT TIME ZONE '${DEFAULT_TZ}' END
       WHERE start_local IS NULL RETURNING 1`,
    );
    if (filled.length) await sql.query(`UPDATE calendars SET last_synced = NULL, last_error = NULL`);
  })().catch((e) => {
    schemaReady = null;
    throw e;
  });
  return schemaReady;
}

export async function listCalendars(): Promise<Calendar[]> {
  await ensureSchema();
  const rows = await sql.query(
    `SELECT id, label, color, enabled, url, last_error, to_char(last_synced AT TIME ZONE 'UTC', ${ISO}) AS last_synced FROM calendars ORDER BY id`,
  );
  return rows.map((r) => ({
    id: r.id as number,
    label: r.label as string,
    color: r.color as string,
    enabled: r.enabled as boolean,
    last_synced: (r.last_synced as string) ?? null,
    last_error: (r.last_error as string) ?? null,
    url_masked: maskUrl(r.url as string),
  }));
}

export async function syncCalendar(id: number): Promise<{ ok: boolean; error?: string; count?: number }> {
  await ensureSchema();
  const rows = await sql`SELECT url FROM calendars WHERE id = ${id}`;
  if (!rows[0]) return { ok: false, error: "no such calendar" };
  try {
    const text = await fetchFeed(rows[0].url as string);
    const today = new Date().toISOString().slice(0, 10);
    const from = new Date(`${addDays(today, -WINDOW_BACK_DAYS)}T00:00:00Z`);
    const to = new Date(`${addDays(today, WINDOW_AHEAD_DAYS)}T00:00:00Z`);
    const events = parseEvents(text, from, to);
    await sql.transaction([
      sql`DELETE FROM calendar_events WHERE calendar_id = ${id}`,
      sql`INSERT INTO calendar_events (calendar_id, uid, start_at, end_at, start_local, end_local, all_day, title, location)
        SELECT ${id}, x.uid, x.start_at, x.end_at, x.start_local, x.end_local, x.all_day, x.title, x.location
        FROM jsonb_to_recordset(${JSON.stringify(events)}::jsonb)
          AS x(uid text, start_at timestamptz, end_at timestamptz, start_local timestamp, end_local timestamp, all_day boolean, title text, location text)`,
      sql`UPDATE calendars SET last_synced = now(), last_error = NULL WHERE id = ${id}`,
    ]);
    return { ok: true, count: events.length };
  } catch (e) {
    const error = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    await sql`UPDATE calendars SET last_error = ${error} WHERE id = ${id}`;
    return { ok: false, error };
  }
}

export async function syncAll(onlyStale: boolean): Promise<void> {
  await ensureSchema();
  const rows = onlyStale
    ? await sql`SELECT id FROM calendars WHERE enabled AND (last_synced IS NULL OR last_synced < now() - ${`${STALE_MINUTES} minutes`}::interval)`
    : await sql`SELECT id FROM calendars WHERE enabled`;
  await Promise.allSettled(rows.map((r) => syncCalendar(r.id as number)));
}

/** True when an enabled calendar has never synced, so the first view should wait for it. */
export async function hasUnsyncedCalendar(): Promise<boolean> {
  await ensureSchema();
  const rows = await sql`SELECT 1 FROM calendars WHERE enabled AND last_synced IS NULL AND last_error IS NULL LIMIT 1`;
  return rows.length > 0;
}

const EVENT_COLS = `e.id, e.title, e.location, e.all_day, c.id AS calendar_id, c.label, c.color,
  to_char(e.start_local, ${LOCAL}) AS start, to_char(e.end_local, ${LOCAL}) AS "end"`;

function toEvent(r: Record<string, unknown>): DayEvent {
  return {
    id: Number(r.id), title: r.title as string, location: r.location as string, all_day: r.all_day as boolean,
    start: r.start as string, end: r.end as string, calendar_id: Number(r.calendar_id), calendar: r.label as string, color: r.color as string,
  };
}

/** Events touching one calendar date (end-exclusive for all-day events, last instant for timed ones). */
export async function getEventsOn(date: string): Promise<DayEvent[]> {
  await ensureSchema();
  const rows = await sql.query(
    `SELECT ${EVENT_COLS}
     FROM calendar_events e JOIN calendars c ON c.id = e.calendar_id
     WHERE c.enabled AND (
       (e.all_day AND e.start_local::date <= $1::date AND e.end_local::date > $1::date)
       OR (NOT e.all_day
         AND e.start_local::date <= $1::date
         AND (GREATEST(e.end_local, e.start_local + interval '1 second') - interval '1 second')::date >= $1::date)
     )
     ORDER BY e.all_day DESC, e.start_local, e.title`,
    [date],
  );
  return rows.map(toEvent);
}

/** Every stored event of the enabled calendars; the sync window already bounds the set. */
export async function getAllEvents(): Promise<DayEvent[]> {
  await ensureSchema();
  const rows = await sql.query(
    `SELECT ${EVENT_COLS}
     FROM calendar_events e JOIN calendars c ON c.id = e.calendar_id
     WHERE c.enabled
     ORDER BY e.all_day DESC, e.start_local, e.title`,
  );
  return rows.map(toEvent);
}
