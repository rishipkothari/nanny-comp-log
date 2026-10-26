import { NextResponse } from "next/server";
import { normalizeUrl, syncCalendar } from "@/lib/calendar";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const COLOR = /^#[0-9a-fA-F]{6}$/;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const b = await req.json();

  if (typeof b.label === "string") {
    const label = b.label.trim().slice(0, 60);
    if (!label) return NextResponse.json({ error: "name required" }, { status: 400 });
    await sql`UPDATE calendars SET label = ${label} WHERE id = ${id}`;
  }
  if (typeof b.color === "string" && COLOR.test(b.color)) await sql`UPDATE calendars SET color = ${b.color} WHERE id = ${id}`;
  if (typeof b.enabled === "boolean") {
    await sql`UPDATE calendars SET enabled = ${b.enabled} WHERE id = ${id}`;
    if (b.enabled) await syncCalendar(id);
  }
  if (typeof b.url === "string" && b.url.trim()) {
    const url = normalizeUrl(b.url);
    if (!url) return NextResponse.json({ error: "invalid calendar URL" }, { status: 400 });
    await sql`UPDATE calendars SET url = ${url}, last_synced = NULL, last_error = NULL WHERE id = ${id}`;
    return NextResponse.json({ ok: true, sync: await syncCalendar(id) });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  await sql`DELETE FROM calendars WHERE id = ${id}`; // events go with it (ON DELETE CASCADE)
  return NextResponse.json({ ok: true });
}
