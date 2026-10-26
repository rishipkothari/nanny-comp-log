import { NextResponse } from "next/server";
import { saveSettings } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export async function PUT(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const bad = await saveSettings(await req.json());
  if (bad.length) return NextResponse.json({ error: `invalid: ${bad.join(", ")}` }, { status: 400 });
  return NextResponse.json({ ok: true });
}
