import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export async function PUT(req: Request) {
  const b = await req.json();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return NextResponse.json({ error: "bad date" }, { status: 400 });
  await sql`
    INSERT INTO days (date, hours, minutes, stipend, expenses, vacation, sick, holiday, notes)
    VALUES (${b.date}, ${n(b.hours)}, ${n(b.minutes)}, ${n(b.stipend)}, ${n(b.expenses)}, ${n(b.vacation)}, ${n(b.sick)}, ${Boolean(b.holiday)}, ${String(b.notes ?? "")})
    ON CONFLICT (date) DO UPDATE SET hours = EXCLUDED.hours, minutes = EXCLUDED.minutes, stipend = EXCLUDED.stipend,
      expenses = EXCLUDED.expenses, vacation = EXCLUDED.vacation, sick = EXCLUDED.sick, holiday = EXCLUDED.holiday, notes = EXCLUDED.notes`;
  return NextResponse.json({ ok: true });
}
