import { NextResponse } from "next/server";
import { applyScheduledHours } from "@/lib/schedule";

/** Logs a day's scheduled total as its working hours (anyone signed in can log hours, as on the timesheet). */
export async function PUT(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return NextResponse.json({ error: "bad date" }, { status: 400 });
  const r = await applyScheduledHours(b.date);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 409 });
}
