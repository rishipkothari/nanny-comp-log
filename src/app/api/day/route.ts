import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const int = (v: unknown, max: number) => {
  const x = Math.round(Number(v));
  return Number.isFinite(x) ? Math.min(Math.max(x, 0), max) : 0;
};
const money = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.min(Math.max(Math.round(x * 100) / 100, 0), 99999999) : 0;
};

export async function PUT(req: Request) {
  const b = await req.json();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return NextResponse.json({ error: "bad date" }, { status: 400 });

  const wh = int(b.wh, 99), wm = int(b.wm, 59);
  const vh = int(b.vh, 99), vm = int(b.vm, 59);
  const sh = int(b.sh, 99), sm = int(b.sm, 59);
  const hh = int(b.hh, 99), hm = int(b.hm, 59);
  // legacy columns, kept in sync for the previous release
  const vacation = Math.round(((vh * 60 + vm) / 60) * 100) / 100;
  const sick = Math.round(((sh * 60 + sm) / 60) * 100) / 100;

  await sql`
    INSERT INTO days (date, hours, minutes, vac_h, vac_m, sick_h, sick_m, hol_h, hol_m, stipend, expenses, vacation, sick, holiday, notes)
    VALUES (${b.date}, ${wh}, ${wm}, ${vh}, ${vm}, ${sh}, ${sm}, ${hh}, ${hm}, ${money(b.stipend)}, ${money(b.expenses)},
      ${vacation}, ${sick}, ${hh * 60 + hm > 0}, ${String(b.notes ?? "").slice(0, 500)})
    ON CONFLICT (date) DO UPDATE SET hours = EXCLUDED.hours, minutes = EXCLUDED.minutes,
      vac_h = EXCLUDED.vac_h, vac_m = EXCLUDED.vac_m, sick_h = EXCLUDED.sick_h, sick_m = EXCLUDED.sick_m,
      hol_h = EXCLUDED.hol_h, hol_m = EXCLUDED.hol_m, stipend = EXCLUDED.stipend, expenses = EXCLUDED.expenses,
      vacation = EXCLUDED.vacation, sick = EXCLUDED.sick, holiday = EXCLUDED.holiday, notes = EXCLUDED.notes`;
  return NextResponse.json({ ok: true });
}
