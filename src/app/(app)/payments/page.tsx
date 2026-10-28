import Link from "next/link";
import PaymentCard from "@/components/PaymentCard";
import { PaymentLog } from "@/components/SummaryTables";
import { buildPeriods, todayET } from "@/lib/calc";
import { getDays, getPayments, getSettings } from "@/lib/db";
import { isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Payments({ searchParams }: { searchParams: Promise<{ p?: string; v?: string }> }) {
  const { p: focus, v } = await searchParams;
  const table = v === "summary" || v === "table"; // "table" is the old name
  const [days, payments, settings, admin] = await Promise.all([getDays(), getPayments(), getSettings(), isAdmin()]);
  const periods = buildPeriods(days, payments, settings);
  const today = todayET();
  return (
    <>
      <div className="tabs">
        <Link href="/payments" className={table ? "" : "on"}>Cards</Link>
        <Link href="/payments?v=summary" className={table ? "on" : ""}>Summary</Link>
      </div>
      {admin ? (
        <p className="muted small">Admin mode is on. Changes save automatically.</p>
      ) : (
        <p className="muted small">
          View only. <Link href={`/admin?next=${encodeURIComponent(table ? "/payments?v=summary" : "/payments")}`}>Unlock admin mode</Link> to edit.
        </p>
      )}
      {table ? (
        <PaymentLog periods={periods} editable={admin} today={today} venmoHandle={settings.venmoHandle} />
      ) : (
        periods.map((p) => (
          <PaymentCard
            key={`${p.start}-${admin}`}
            period={p}
            editable={admin}
            today={today}
            venmoHandle={settings.venmoHandle}
            defaultOpen={p.start === focus}
          />
        ))
      )}
    </>
  );
}
