import { NextResponse } from "next/server";
import { clearManualDay, saveManualDay } from "@/lib/schedule";
import { requireAdmin } from "@/lib/session";

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Saves a hand-entered schedule day, which then wins over the deduced one. */
export async function PUT(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  if (!isDate(b.date)) return NextResponse.json({ error: "bad date" }, { status: 400 });
  const error = await saveManualDay(b.date, {
    working: b.working === true,
    blocks: Array.isArray(b.blocks) ? b.blocks.slice(0, 12) : [],
    note: typeof b.note === "string" ? b.note : "",
  });
  return error ? NextResponse.json({ error }, { status: 400 }) : NextResponse.json({ ok: true });
}

/** Drops a hand-entered day so the deduced schedule shows again. */
export async function DELETE(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  if (!isDate(b.date)) return NextResponse.json({ error: "bad date" }, { status: 400 });
  await clearManualDay(b.date);
  return NextResponse.json({ ok: true });
}
