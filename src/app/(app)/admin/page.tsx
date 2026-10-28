import PasswordInput from "@/components/PasswordInput";
import { safeNext } from "@/lib/auth";
import { isAdmin } from "@/lib/session";

export default async function Admin({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  const admin = await isAdmin();
  const configured = Boolean(process.env.ADMIN_PASSWORD);
  return (
    <>
      <h1>Admin mode</h1>
      {admin ? (
        <>
          <p className="muted">Admin mode is on. You can edit payments and settings.</p>
          <form method="post" action="/api/admin/logout">
            <button type="submit">Lock admin mode</button>
          </form>
        </>
      ) : !configured ? (
        <p className="err">ADMIN_PASSWORD is not set on the server.</p>
      ) : (
        <>
          <p className="muted">Enter the admin password to edit payments and settings.</p>
          {error && <div className="err">Wrong admin password.</div>}
          <form method="post" action="/api/admin/login" className="adminform">
            <input type="hidden" name="next" value={safeNext(next, "/?tab=admin")} />
            <PasswordInput placeholder="Admin password" />
            <button className="primary" type="submit" style={{ width: "100%" }}>
              Unlock
            </button>
          </form>
        </>
      )}
    </>
  );
}
