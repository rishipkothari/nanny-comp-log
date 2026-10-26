export const OT_THRESHOLD = 40;
export const OT_RATE = 28;

const DAY = 86400000;

function parse(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function format(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(s: string, n: number): string {
  return format(parse(s) + n * DAY);
}

/** Pay periods run Saturday through Friday. */
export function periodStart(date: string): string {
  const dow = new Date(parse(date)).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 1) % 7));
}

/** Same numbering the sheet used: year-(Excel WEEKNUM(start + 8) - 1). */
export function periodId(start: string): string {
  const d = parse(addDays(start, 8));
  const y = new Date(d).getUTCFullYear();
  const jan1 = Date.UTC(y, 0, 1);
  const week1 = jan1 - new Date(jan1).getUTCDay() * DAY;
  const week = Math.floor((d - week1) / (7 * DAY)) + 1;
  return `${y}-${week - 1}`;
}

export type DayRow = {
  date: string;
  hours: number;
  minutes: number;
  stipend: number;
  expenses: number;
  vacation: number;
  sick: number;
  holiday: boolean;
  notes: string;
};

export type PaymentRow = {
  period_start: string;
  homepay_earnings: number | null;
  homepay_net: number | null;
  homepay_date: string | null;
  personal_paid: number | null;
  personal_date: string | null;
  route: string | null;
  notes: string | null;
};

export type Period = {
  id: string;
  start: string;
  end: string;
  worked: number;
  stipend: number;
  expenses: number;
  vacation: number;
  sick: number;
  total: number;
  ot: number;
  personalDue: number;
  payment: PaymentRow | null;
  totalPaid: number;
};

export function dayHours(d: Pick<DayRow, "hours" | "minutes">): number {
  return d.hours + d.minutes / 60;
}

export function buildPeriods(days: DayRow[], payments: PaymentRow[]): Period[] {
  const byStart = new Map<string, Period>();
  const payMap = new Map(payments.map((p) => [p.period_start, p]));

  const ensure = (start: string): Period => {
    let p = byStart.get(start);
    if (!p) {
      p = {
        id: periodId(start),
        start,
        end: addDays(start, 6),
        worked: 0,
        stipend: 0,
        expenses: 0,
        vacation: 0,
        sick: 0,
        total: 0,
        ot: 0,
        personalDue: 0,
        payment: payMap.get(start) ?? null,
        totalPaid: 0,
      };
      byStart.set(start, p);
    }
    return p;
  };

  for (const d of days) {
    const p = ensure(periodStart(d.date));
    p.worked += dayHours(d);
    p.stipend += d.stipend;
    p.expenses += d.expenses;
    p.vacation += d.vacation;
    p.sick += d.sick;
  }
  for (const start of payMap.keys()) ensure(start);

  const out = [...byStart.values()];
  for (const p of out) {
    p.total = p.worked + p.vacation + p.sick;
    p.ot = Math.max(p.total - OT_THRESHOLD, 0);
    p.personalDue = p.ot * OT_RATE + p.stipend + p.expenses;
    p.totalPaid = (p.payment?.homepay_net ?? 0) + (p.payment?.personal_paid ?? 0);
  }
  return out
    .filter((p) => p.total > 0 || p.stipend > 0 || p.expenses > 0 || p.payment)
    .sort((a, b) => (a.start < b.start ? 1 : -1));
}

export function venmoNote(p: Pick<Period, "start" | "end">): string {
  return `Pay period: ${p.start} to ${p.end}, personal pay`;
}

export const money = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

export const hrs = (n: number) => n.toFixed(2);

export function fmtDate(s: string | null | undefined): string {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${Number(m)}/${Number(d)}/${y}`;
}

export function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}
