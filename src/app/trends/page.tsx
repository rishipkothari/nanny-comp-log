import Link from "next/link";
import Nav from "@/components/Nav";
import TrendChart from "@/components/TrendChart";
import { buildPeriods, fmtDate } from "@/lib/calc";
import { getDays, getPayments } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Trends({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const earnings = tab === "earnings";
  const periods = buildPeriods(await getDays(), await getPayments()).reverse();

  const hoursData = periods.map((p) => ({ label: p.id, total: Number(p.total.toFixed(2)) }));
  const earningsData = periods.map((p) => ({
    label: fmtDate(p.end),
    total: Number(p.totalPaid.toFixed(2)),
    homepay: p.payment?.homepay_net ?? 0,
    personal: p.payment?.personal_paid ?? 0,
  }));

  return (
    <main>
      <div className="tabs">
        <Link href="/trends" className={earnings ? "" : "on"}>Hours</Link>
        <Link href="/trends?tab=earnings" className={earnings ? "on" : ""}>Earnings</Link>
      </div>
      {earnings ? (
        <TrendChart
          money
          data={earningsData}
          series={[
            { key: "total", label: "Total paid", color: "#d9822b" },
            { key: "homepay", label: "Homepay net", color: "#2f7fd6" },
            { key: "personal", label: "Personal comp", color: "#8e44e0" },
          ]}
        />
      ) : (
        <TrendChart data={hoursData} series={[{ key: "total", label: "Total hours", color: "#2f7fd6" }]} />
      )}
      <Nav active="trends" />
    </main>
  );
}
