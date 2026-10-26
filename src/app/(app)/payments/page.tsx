import Link from "next/link";
import PaymentCard from "@/components/PaymentCard";
import { buildPeriods } from "@/lib/calc";
import { getDays, getPayments, getSettings } from "@/lib/db";
import { isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Payments() {
  const [days, payments, settings, admin] = await Promise.all([getDays(), getPayments(), getSettings(), isAdmin()]);
  const periods = buildPeriods(days, payments, settings);
  return (
    <>
      {admin ? (
        <p className="muted small">Admin mode is on. Changes save automatically.</p>
      ) : (
        <p className="muted small">
          View only. <Link href="/admin">Unlock admin mode</Link> to edit.
        </p>
      )}
      {periods.map((p) => (
        <PaymentCard key={`${p.start}-${admin}`} period={p} editable={admin} />
      ))}
    </>
  );
}
