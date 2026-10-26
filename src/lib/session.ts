import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminToken } from "./auth";

export async function isAdmin(): Promise<boolean> {
  const expected = await adminToken();
  if (!expected) return false;
  return (await cookies()).get(ADMIN_COOKIE)?.value === expected;
}

/** For API routes: returns a 403 response when not in admin mode, otherwise null. */
export async function requireAdmin(): Promise<NextResponse | null> {
  return (await isAdmin()) ? null : NextResponse.json({ error: "admin mode required" }, { status: 403 });
}
