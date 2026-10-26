import PasswordInput from "@/components/PasswordInput";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="login">
      <h1>Nanny Comp Log</h1>
      {error && <div className="err">Wrong password.</div>}
      <form method="post" action="/api/login">
        <PasswordInput />
        <button className="primary" type="submit" style={{ width: "100%" }}>
          Sign in
        </button>
      </form>
    </div>
  );
}
