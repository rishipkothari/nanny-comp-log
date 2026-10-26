export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="login">
      <h1>Nanny Comp Log</h1>
      {error && <div className="err">Wrong password.</div>}
      <form method="post" action="/api/login">
        <input type="password" name="password" placeholder="Password" autoFocus required />
        <button className="primary" type="submit" style={{ width: "100%" }}>
          Sign in
        </button>
      </form>
    </div>
  );
}
