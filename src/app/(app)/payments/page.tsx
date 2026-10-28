import Link from "next/link";
import PaymentCard from "@/components/PaymentCard";
import { PaymentsTable } from "@/components/SummaryTables";
import { buildPeriods, paymentsRows, todayET } from "@/lib/calc";
import { getDays, getPayments, getSettings } from "@/lib/db";
import { isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Payments({ searchParams }: { searchParams: Promise<{ p?: string; view?: string }> }) {
  const { p: focus, view } = await searchParams;
  const summary = view === "summary";
  const [days, payments, settings, admin] = await Promise.all([getDays(), getPayments(), getSettings(), isAdmin()]);
  const periods = buildPeriods(days, payments, settings);
  const today = todayET();
  const tabs = (
    <div className="tabs">
      <Link href="/payments" className={summary ? "" : "on"}>Pay periods</Link>
      <Link href="/payments?view=summary" className={summary ? "on" : ""}>Summary</Link>
    </div>
  );
  if (summary) {
    // read-only; a row opens that period's card
    return (
      <>
        {tabs}
        <PaymentsTable rows={paymentsRows(periods, "period", today)} href={(r) => `/payments?p=${r.key}`} />
      </>
    );
  }
  return (
    <>
      {tabs}
      {admin ? (
        <p className="muted small">Admin mode is on. Changes save automatically.</p>
      ) : (
        <p className="muted small">
          View only. <Link href="/admin?next=/payments">Unlock admin mode</Link> to edit.
        </p>
      )}
      {periods.map((p) => (
        <PaymentCard
          key={`${p.start}-${admin}`}
          period={p}
          editable={admin}
          today={today}
          venmoHandle={settings.venmoHandle}
          defaultOpen={p.start === focus}
        />
      ))}
    </>
  );
}
