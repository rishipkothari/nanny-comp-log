import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { periodStart } from "@/lib/calc";
import { deduceSchedule, hasApiKey } from "@/lib/schedule";
import { requireAdmin } from "@/lib/session";

// One call reads three weeks of calendar; give it room beyond the default function timeout.
export const maxDuration = 120;

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!hasApiKey()) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set on the server" }, { status: 503 });

  const b = await req.json().catch(() => ({}));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.start)) return NextResponse.json({ error: "bad date" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await deduceSchedule(periodStart(b.start), b.force === true)) });
  } catch (e) {
    const error =
      e instanceof Anthropic.AuthenticationError ? "The Anthropic API key was rejected"
      : e instanceof Anthropic.RateLimitError ? "Claude is rate limited right now; try again in a minute"
      : e instanceof Anthropic.APIError ? `Claude request failed (${e.status ?? "network"})`
      : e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error }, { status: 502 });
  }
}
