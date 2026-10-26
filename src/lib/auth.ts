export const COOKIE = "ncl_session";
export const ADMIN_COOKIE = "ncl_admin";
export const ONE_YEAR = 60 * 60 * 24 * 365;

async function hmac(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sessionToken(): Promise<string> {
  const secret = process.env.APP_PASSWORD;
  if (!secret) throw new Error("APP_PASSWORD is not set");
  return hmac(secret, "nanny-comp-log");
}

/** null when ADMIN_PASSWORD is not configured: admin mode is then impossible. */
export async function adminToken(): Promise<string | null> {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return null;
  return hmac(secret, "nanny-comp-log-admin");
}

/** Only allow same-site relative redirects. */
export function safeNext(next: unknown, fallback = "/"): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
