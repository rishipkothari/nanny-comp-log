import Link from "next/link";
import PeriodHoursTable, { type PeriodDetail } from "@/components/PeriodHoursTable";
import SummaryChart, { type Point, type SeriesDef } from "@/components/SummaryChart";
import {
  GROUPS, buildPeriods, fmtDate, holidayHours, hoursRows, hrs, money, paymentsRows, periodStart, sickHours, todayET, vacationHours, workedHours,
  type Group, type Period,
} from "@/lib/calc";
import { getDays, getPayments, getSettings } from "@/lib/db";
import { getScheduleDays, scheduledTotal } from "@/lib/schedule";

export const dynamic = "force-dynamic";

const HOUR_SERIES: SeriesDef[] = [
  { key: "working", label: "Working", color: "#2f7fd6", on: true },
  { key: "vacation", label: "Vacation", color: "#2e9d62", on: true },
  { key: "sick", label: "Sick", color: "#d9534f", on: true },
  { key: "holiday", label: "Holiday", color: "#8e44e0", on: true },
];
const PAY_SERIES: SeriesDef[] = [
  { key: "total", label: "Total paid", color: "#d9822b", on: true },
  { key: "homepay", label: "Homepay net", color: "#2f7fd6", on: true },
  { key: "personal", label: "Personal comp paid", color: "#8e44e0", on: true },
  { key: "due", label: "Personal comp due", color: "#6b7686", on: false },
];

type Params = { m?: string; v?: string; g?: string };

export default async function Summary({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const mode = sp.m === "payments" ? "payments" : "hours";
  const view = sp.v === "chart" ? "chart" : "table";
  const group: Group = GROUPS.some((g) => g.key === sp.g) ? (sp.g as Group) : "period";
  const today = todayET();

  const [days, payments, settings] = await Promise.all([getDays(), getPayments(), getSettings()]);
  const periods = buildPeriods(days, payments, settings);

  const href = (over: Params) => {
    const q = new URLSearchParams({ m: mode, v: view, g: group, ...over } as Record<string, string>);
    return `/summary?${q.toString()}`;
  };

  return (
    <>
      <div className="seg" role="tablist" aria-label="Measure">
        <Link href={href({ m: "hours" })} className={mode === "hours" ? "on" : ""}>Hours</Link>
        <Link href={href({ m: "payments" })} className={mode === "payments" ? "on" : ""}>Payments</Link>
      </div>
      <div className="tabs">
        <Link href={href({ v: "table" })} className={view === "table" ? "on" : ""}>Table</Link>
        <Link href={href({ v: "chart" })} className={view === "chart" ? "on" : ""}>Chart</Link>
      </div>

      {view === "table" ? (
        <>
          <div className="chips">
            {GROUPS.map((g) => (
              <Link key={g.key} href={href({ g: g.key })} className={g.key === group ? "chip on" : "chip"}>{g.label}</Link>
            ))}
          </div>
          {mode === "payments" ? (
            <PaymentsTable rows={paymentsRows(periods, group, today)} />
          ) : group === "period" ? (
            <PeriodHoursTable rows={await periodDetails(periods)} />
          ) : (
            <HoursTable rows={hoursRows(days, periods, group, today)} group={group} />
          )}
          {group !== "period" && (
            <p className="muted small">
              {mode === "hours"
                ? "Month and year totals use each day’s own date."
                : "Month and year totals use the pay period’s end date."}
            </p>
          )}
        </>
      ) : mode === "hours" ? (
        <SummaryChart
          unit="hours"
          series={HOUR_SERIES}
          today={today}
          daily={days.map<Point>((d) => ({
            date: d.date,
            label: `${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8, 10))}`,
            values: { working: workedHours(d), vacation: vacationHours(d), sick: sickHours(d), holiday: holidayHours(d) },
          }))}
          periods={[...periods].reverse().map<Point>((p) => ({
            date: p.end,
            label: fmtDate(p.end).replace(/\/\d{4}$/, ""),
            values: { working: p.worked, vacation: p.vacation, sick: p.sick, holiday: p.holiday },
          }))}
        />
      ) : (
        <SummaryChart
          unit="money"
          series={PAY_SERIES}
          today={today}
          windows={["month", "quarter", "ytd", "year", "all"]}
          daily={null}
          periods={[...periods].reverse().map<Point>((p) => ({
            date: p.end,
            label: fmtDate(p.end).replace(/\/\d{4}$/, ""),
            values: { total: p.totalPaid, homepay: p.homepayNet, personal: p.personalPaid, due: p.personalDue },
          }))}
        />
      )}
    </>
  );
}

/** Each pay period's totals plus what the deduced schedule adds up to for it. */
async function periodDetails(periods: Period[]): Promise<PeriodDetail[]> {
  if (!periods.length) return [];
  const schedule = await getScheduleDays(periods[periods.length - 1].start, periods[0].end);
  const byStart = new Map<string, typeof schedule>();
  for (const d of schedule) {
    const start = periodStart(d.date);
    byStart.set(start, [...(byStart.get(start) ?? []), d]);
  }
  return periods.map((p) => {
    const days = byStart.get(p.start);
    return {
      id: p.id, start: p.start, end: p.end,
      working: p.worked, vacation: p.vacation, sick: p.sick, holiday: p.holiday, total: p.total, ot: p.ot,
      stipend: p.stipend, expenses: p.expenses,
      scheduled: days ? scheduledTotal(days) : null,
    };
  });
}

function HoursTable({ rows, group }: { rows: ReturnType<typeof hoursRows>; group: Group }) {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>{group === "month" ? "Month" : "Year"}</th>
            <th>Working</th><th>Vacation</th><th>Sick</th><th>Holiday</th><th>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td>{hrs(r.working)}</td><td>{hrs(r.vacation)}</td><td>{hrs(r.sick)}</td><td>{hrs(r.holiday)}</td>
              <td><b>{hrs(r.total)}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentsTable({ rows }: { rows: ReturnType<typeof paymentsRows> }) {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Period</th><th>Homepay net</th><th>Personal due</th><th>Personal paid</th><th>Owed</th><th>Total paid</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td>{money(r.homepay)}</td><td>{money(r.due)}</td><td>{money(r.paid)}</td>
              <td className={Math.abs(r.owed) >= 0.005 ? "ot" : ""}>{money(r.owed)}</td>
              <td><b>{money(r.totalPaid)}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
