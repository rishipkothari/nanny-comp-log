import { NextResponse } from "next/server";
import { ADMIN_COOKIE, ONE_YEAR, adminToken, safeNext } from "@/lib/auth";

export async function POST(req: Request) {
  const form = await req.formData();
  const token = await adminToken();
  const ok = token !== null && form.get("password") === process.env.ADMIN_PASSWORD;
  const next = safeNext(form.get("next"), "/payments");
  const res = NextResponse.redirect(new URL(ok ? next : `/admin?error=1&next=${encodeURIComponent(next)}`, req.url), 303);
  if (ok) {
    res.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ONE_YEAR,
    });
  }
  return res;
}
