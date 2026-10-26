import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const numOrNull = (v: unknown) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const strOrNull = (v: unknown) => (v === "" || v == null ? null : String(v));

export async function PUT(req: Request) {
  const b = await req.json();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.period_start)) return NextResponse.json({ error: "bad period" }, { status: 400 });
  await sql`
    INSERT INTO payments (period_start, homepay_earnings, homepay_net, homepay_date, personal_paid, personal_date, route, notes)
    VALUES (${b.period_start}, ${numOrNull(b.homepay_earnings)}, ${numOrNull(b.homepay_net)}, ${strOrNull(b.homepay_date)},
      ${numOrNull(b.personal_paid)}, ${strOrNull(b.personal_date)}, ${strOrNull(b.route)}, ${strOrNull(b.notes)})
    ON CONFLICT (period_start) DO UPDATE SET homepay_earnings = EXCLUDED.homepay_earnings, homepay_net = EXCLUDED.homepay_net,
      homepay_date = EXCLUDED.homepay_date, personal_paid = EXCLUDED.personal_paid, personal_date = EXCLUDED.personal_date,
      route = EXCLUDED.route, notes = EXCLUDED.notes`;
  return NextResponse.json({ ok: true });
}
