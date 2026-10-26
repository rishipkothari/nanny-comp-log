import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const numOrNull = (v: unknown) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const strOrNull = (v: unknown) => (v === "" || v == null ? null : String(v));
const dateOrNull = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export async function PUT(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const b = await req.json();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.period_start)) return NextResponse.json({ error: "bad period" }, { status: 400 });
  const approved = b.approved === true;
  // approved_at is the server time of the last time the checkbox actually changed.
  const rows = await sql`
    INSERT INTO payments (period_start, homepay_earnings, homepay_net, homepay_date, personal_paid, personal_date, route, notes, approved, approved_at)
    VALUES (${b.period_start}, ${numOrNull(b.homepay_earnings)}, ${numOrNull(b.homepay_net)}, ${dateOrNull(b.homepay_date)},
      ${numOrNull(b.personal_paid)}, ${dateOrNull(b.personal_date)}, ${strOrNull(b.route)}, ${strOrNull(b.notes)},
      ${approved}, CASE WHEN ${approved} THEN now() END)
    ON CONFLICT (period_start) DO UPDATE SET homepay_earnings = EXCLUDED.homepay_earnings, homepay_net = EXCLUDED.homepay_net,
      homepay_date = EXCLUDED.homepay_date, personal_paid = EXCLUDED.personal_paid, personal_date = EXCLUDED.personal_date,
      route = EXCLUDED.route, notes = EXCLUDED.notes, approved = EXCLUDED.approved,
      approved_at = CASE WHEN payments.approved IS DISTINCT FROM EXCLUDED.approved THEN now() ELSE payments.approved_at END
    RETURNING approved, to_char(approved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS approved_at`;
  return NextResponse.json({ ok: true, approved: rows[0].approved, approved_at: rows[0].approved_at });
}
