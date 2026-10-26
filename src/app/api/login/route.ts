import { NextResponse } from "next/server";
import { COOKIE, ONE_YEAR, sessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  const form = await req.formData();
  const ok = form.get("password") === process.env.APP_PASSWORD;
  const res = NextResponse.redirect(new URL(ok ? "/" : "/login?error=1", req.url), 303);
  if (ok) {
    res.cookies.set(COOKIE, await sessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ONE_YEAR,
    });
  }
  return res;
}
