import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { periodStart } from "../src/lib/calc";

const sql = neon(process.env.DATABASE_URL!);
const file = process.argv[2] ?? "import/source.xlsx";
const wb = XLSX.read(readFileSync(file), { type: "buffer" });

const iso = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
};
const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
};

// Full Log: A date, B hours, C minutes, E stipend, F expenses, G vacation, H sick, L holiday, M notes
const log = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["Full Log"], { header: 1, raw: true }).slice(1);
const days = [];
for (const r of log) {
  const date = iso(r[0]);
  if (!date) continue;
  const row = {
    date,
    hours: num(r[1]) ?? 0,
    minutes: num(r[2]) ?? 0,
    stipend: num(r[4]) ?? 0,
    expenses: num(r[5]) ?? 0,
    vacation: num(r[6]) ?? 0,
    sick: num(r[7]) ?? 0,
    holiday: r[11] === true || String(r[11]).toUpperCase() === "TRUE",
    notes: r[12] == null ? "" : String(r[12]),
  };
  const empty = !row.hours && !row.minutes && !row.stipend && !row.expenses && !row.vacation && !row.sick && !row.holiday && !row.notes;
  if (!empty) days.push(row);
}

// Payment Log: B start, D homepay earnings, E net paid, F paid date, H personal paid, I paid date, J route, M notes
const pay = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["Payment Log"], { header: 1, raw: true }).slice(1);
const payments = new Map<string, Record<string, unknown>>();
for (const r of pay) {
  const start = iso(r[1]);
  if (!start) continue;
  const row = {
    period_start: periodStart(start),
    homepay_earnings: num(r[3]),
    homepay_net: num(r[4]),
    homepay_date: iso(r[5]),
    personal_paid: num(r[7]),
    personal_date: iso(r[8]),
    route: r[9] ? String(r[9]) : null,
    notes: r[12] ? String(r[12]) : null,
  };
  const empty = !row.homepay_earnings && !row.homepay_net && !row.homepay_date && !row.personal_paid && !row.personal_date && !row.route && !row.notes;
  if (!empty) payments.set(row.period_start, row);
}

for (const d of days) {
  await sql`INSERT INTO days (date, hours, minutes, stipend, expenses, vacation, sick, holiday, notes)
    VALUES (${d.date}, ${d.hours}, ${d.minutes}, ${d.stipend}, ${d.expenses}, ${d.vacation}, ${d.sick}, ${d.holiday}, ${d.notes})
    ON CONFLICT (date) DO UPDATE SET hours = EXCLUDED.hours, minutes = EXCLUDED.minutes, stipend = EXCLUDED.stipend,
      expenses = EXCLUDED.expenses, vacation = EXCLUDED.vacation, sick = EXCLUDED.sick, holiday = EXCLUDED.holiday, notes = EXCLUDED.notes`;
}
for (const p of payments.values()) {
  await sql`INSERT INTO payments (period_start, homepay_earnings, homepay_net, homepay_date, personal_paid, personal_date, route, notes)
    VALUES (${p.period_start as string}, ${p.homepay_earnings as number | null}, ${p.homepay_net as number | null}, ${p.homepay_date as string | null},
      ${p.personal_paid as number | null}, ${p.personal_date as string | null}, ${p.route as string | null}, ${p.notes as string | null})
    ON CONFLICT (period_start) DO UPDATE SET homepay_earnings = EXCLUDED.homepay_earnings, homepay_net = EXCLUDED.homepay_net,
      homepay_date = EXCLUDED.homepay_date, personal_paid = EXCLUDED.personal_paid, personal_date = EXCLUDED.personal_date,
      route = EXCLUDED.route, notes = EXCLUDED.notes`;
}
console.log(`imported ${days.length} days, ${payments.size} payment rows`);
