import { NextResponse } from "next/server";
import { normalizeUrl, syncCalendar } from "@/lib/calendar";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const COLOR = /^#[0-9a-fA-F]{6}$/;

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const b = await req.json();
  const label = String(b.label ?? "").trim().slice(0, 60);
  const url = normalizeUrl(String(b.url ?? ""));
  const color = COLOR.test(b.color) ? b.color : "#2f5d9e";
  if (!label || !url) return NextResponse.json({ error: "a name and a valid calendar URL are required" }, { status: 400 });

  const rows = await sql`INSERT INTO calendars (label, url, color) VALUES (${label}, ${url}, ${color}) RETURNING id`;
  const sync = await syncCalendar(rows[0].id as number);
  return NextResponse.json({ ok: true, id: rows[0].id, sync });
}
