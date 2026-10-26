import { neon } from "@neondatabase/serverless";
import type { DayRow, PaymentRow } from "./calc";

export const sql = neon(process.env.DATABASE_URL!);

const num = (v: unknown) => (v == null ? 0 : Number(v));

type DayRecord = Record<string, unknown>;

function toDay(r: DayRecord): DayRow {
  return {
    date: r.date as string,
    hours: num(r.hours),
    minutes: num(r.minutes),
    stipend: num(r.stipend),
    expenses: num(r.expenses),
    vacation: num(r.vacation),
    sick: num(r.sick),
    holiday: Boolean(r.holiday),
    notes: (r.notes as string) ?? "",
  };
}

export async function getDay(date: string): Promise<DayRow | null> {
  const rows = await sql`SELECT date::text AS date, hours, minutes, stipend, expenses, vacation, sick, holiday, notes FROM days WHERE date = ${date}`;
  return rows[0] ? toDay(rows[0]) : null;
}

export async function getDays(): Promise<DayRow[]> {
  const rows = await sql`SELECT date::text AS date, hours, minutes, stipend, expenses, vacation, sick, holiday, notes FROM days ORDER BY date`;
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
