import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export async function PUT(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const b = await req.json();
  const rate = Number(b.otRate);
  const threshold = Number(b.otThreshold);
  if (!Number.isFinite(rate) || rate < 0 || !Number.isFinite(threshold) || threshold < 0) {
    return NextResponse.json({ error: "invalid values" }, { status: 400 });
  }
  await sql`INSERT INTO settings (key, value) VALUES ('ot_rate', ${rate}), ('ot_threshold', ${threshold})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  return NextResponse.json({ ok: true });
}
