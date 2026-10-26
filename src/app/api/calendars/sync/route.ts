import { NextResponse } from "next/server";
import { syncAll, syncCalendar } from "@/lib/calendar";
import { requireAdmin } from "@/lib/session";

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const b = await req.json().catch(() => ({}));
  if (Number.isInteger(b.id)) return NextResponse.json({ ok: true, sync: await syncCalendar(b.id) });
  await syncAll(false);
  return NextResponse.json({ ok: true });
}
