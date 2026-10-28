import Link from "next/link";
import PaymentCard, { PaymentTableRow } from "@/components/PaymentCard";
import { buildPeriods, todayET } from "@/lib/calc";
import { getDays, getPayments, getSettings } from "@/lib/db";
import { isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Payments({ searchParams }: { searchParams: Promise<{ p?: string; v?: string }> }) {
  const { p: focus, v } = await searchParams;
  const table = v === "table";
  const [days, payments, settings, admin] = await Promise.all([getDays(), getPayments(), getSettings(), isAdmin()]);
  const periods = buildPeriods(days, payments, settings);
  const today = todayET();
  return (
    <>
      <div className="tabs">
        <Link href="/payments" className={table ? "" : "on"}>Cards</Link>
        <Link href="/payments?v=table" className={table ? "on" : ""}>Table</Link>
      </div>
      {admin ? (
        <p className="muted small">Admin mode is on. Changes save automatically.</p>
      ) : (
        <p className="muted small">
          View only. <Link href={`/admin?next=${encodeURIComponent(table ? "/payments?v=table" : "/payments")}`}>Unlock admin mode</Link> to edit.
        </p>
      )}
      {table ? (
        <div className="tablewrap paylog">
          <table>
            <thead>
              <tr>
                <th>Pay period</th><th>Status</th><th>Approved</th><th>Hours</th>
                <th>Homepay earnings</th><th>Homepay net</th><th>Homepay date</th>
                <th>Personal due</th><th>Personal paid</th><th>Personal date</th><th>Route</th>
                <th>Owed</th><th>Total paid</th><th className="l">Notes</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <PaymentTableRow key={`${p.start}-${admin}`} period={p} editable={admin} today={today} venmoHandle={settings.venmoHandle} />
              ))}
            </tbody>
          </table>
        </div>
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
