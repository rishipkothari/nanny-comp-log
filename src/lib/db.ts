import { neon } from "@neondatabase/serverless";
import { DEFAULT_SETTINGS, type DayRow, type PaymentRow, type Settings } from "./calc";

export const sql = neon(process.env.DATABASE_URL!);

const num = (v: unknown) => (v == null ? 0 : Number(v));

const DAY_COLS = `date::text AS date, hours, minutes, vac_h, vac_m, sick_h, sick_m, hol_h, hol_m, stipend, expenses, notes`;

function toDay(r: Record<string, unknown>): DayRow {
  return {
    date: r.date as string,
    wh: num(r.hours), wm: num(r.minutes),
    vh: num(r.vac_h), vm: num(r.vac_m),
    sh: num(r.sick_h), sm: num(r.sick_m),
    hh: num(r.hol_h), hm: num(r.hol_m),
    stipend: num(r.stipend),
    expenses: num(r.expenses),
    notes: (r.notes as string) ?? "",
  };
}

export async function getDay(date: string): Promise<DayRow | null> {
  const rows = await sql.query(`SELECT ${DAY_COLS} FROM days WHERE date = $1`, [date]);
  return rows[0] ? toDay(rows[0]) : null;
}

export async function getDayRange(from: string, to: string): Promise<DayRow[]> {
  const rows = await sql.query(`SELECT ${DAY_COLS} FROM days WHERE date BETWEEN $1 AND $2 ORDER BY date`, [from, to]);
  return rows.map(toDay);
}

export async function getDays(): Promise<DayRow[]> {
  const rows = await sql.query(`SELECT ${DAY_COLS} FROM days ORDER BY date`);
  return rows.map(toDay);
}

export async function getPayments(): Promise<PaymentRow[]> {
  const rows = await sql`SELECT period_start::text AS period_start, homepay_earnings, homepay_net, homepay_date::text AS homepay_date, personal_paid, personal_date::text AS personal_date, route, notes FROM payments`;
  return rows.map((r) => ({
    period_start: r.period_start as string,
    homepay_earnings: r.homepay_earnings == null ? null : Number(r.homepay_earnings),
    homepay_net: r.homepay_net == null ? null : Number(r.homepay_net),
    homepay_date: (r.homepay_date as string) ?? null,
    personal_paid: r.personal_paid == null ? null : Number(r.personal_paid),
    personal_date: (r.personal_date as string) ?? null,
    route: (r.route as string) ?? null,
    notes: (r.notes as string) ?? null,
  }));
}

export async function getSettings(): Promise<Settings> {
  const rows = await sql`SELECT key, value FROM settings`;
  const m = new Map(rows.map((r) => [r.key as string, Number(r.value)]));
  return {
    otRate: m.get("ot_rate") ?? DEFAULT_SETTINGS.otRate,
    otThreshold: m.get("ot_threshold") ?? DEFAULT_SETTINGS.otThreshold,
  };
}
