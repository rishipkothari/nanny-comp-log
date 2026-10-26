import { NextResponse } from "next/server";
import { COOKIE, sessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  const form = await req.formData();
  const ok = form.get("password") === process.env.APP_PASSWORD;
  const url = new URL(ok ? "/" : "/login?error=1", req.url);
  const res = NextResponse.redirect(url, 303);
  if (ok) {
    res.cookies.set(COOKIE, await sessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}
