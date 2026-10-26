import Link from "next/link";
import Nav from "@/components/Nav";
import PaymentCard from "@/components/PaymentCard";
import { buildPeriods, fmtDate, hrs, money } from "@/lib/calc";
import { getDays, getPayments } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Summary({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const payments = tab === "payments";
  const periods = buildPeriods(await getDays(), await getPayments());

  return (
    <main>
      <div className="tabs">
        <Link href="/summary" className={payments ? "" : "on"}>Pay periods</Link>
        <Link href="/summary?tab=payments" className={payments ? "on" : ""}>Payments</Link>
      </div>

      {payments ? (
        periods.map((p) => <PaymentCard key={p.start} period={p} />)
      ) : (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Start</th><th>End</th><th>Worked</th><th>Vac</th><th>Sick</th><th>Total</th><th>OT</th><th>Stipend</th><th>Expenses</th><th>Personal pay</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.start}>
                  <td>{fmtDate(p.start)}</td>
                  <td>{fmtDate(p.end)}</td>
                  <td>{hrs(p.worked)}</td>
                  <td>{hrs(p.vacation)}</td>
                  <td>{hrs(p.sick)}</td>
                  <td>{hrs(p.total)}</td>
                  <td className={p.ot > 0 ? "ot" : ""}>{hrs(p.ot)}</td>
                  <td>{money(p.stipend)}</td>
                  <td>{money(p.expenses)}</td>
                  <td>{money(p.personalDue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Nav active="summary" />
    </main>
  );
}
