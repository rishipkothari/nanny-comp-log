const DAY = 86400000;

/** DEBUG: model and effort for schedule deduction are switchable from the Schedule page while it is tuned. */
export const SCHEDULE_MODELS = [
  { id: "claude-haiku-5-5", label: "Haiku 5.5" },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5" },
  { id: "claude-opus-5-5", label: "Opus 5.5" },
] as const;
export const SCHEDULE_EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type ScheduleModel = (typeof SCHEDULE_MODELS)[number]["id"];
export type ScheduleEffort = (typeof SCHEDULE_EFFORTS)[number];

export type Settings = {
  otRate: number; otThreshold: number; venmoHandle: string; scheduleHints: string;
  scheduleModel: ScheduleModel; scheduleEffort: ScheduleEffort;
};
export const DEFAULT_SETTINGS: Settings = {
  otRate: 28, otThreshold: 40, venmoHandle: "anat-sweeney",
  scheduleModel: "claude-haiku-5-5", scheduleEffort: "medium",
  scheduleHints: 'All-day events whose title starts with "AS" give the nanny\'s working hours for that day, e.g. "AS 8-5:30" or "AS 7:30-12, 3-6".',
};

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
  wh: number; // working
  wm: number;
  vh: number; // vacation
  vm: number;
  sh: number; // sick
  sm: number;
  hh: number; // holiday
  hm: number;
  stipend: number;
  expenses: number;
  notes: string;
};

export const emptyDay = (date: string): DayRow => ({
  date, wh: 0, wm: 0, vh: 0, vm: 0, sh: 0, sm: 0, hh: 0, hm: 0, stipend: 0, expenses: 0, notes: "",
});

export type PaymentRow = {
  period_start: string;
  homepay_earnings: number | null;
  homepay_net: number | null;
  homepay_date: string | null;
  personal_paid: number | null;
  personal_date: string | null;
  route: string | null;
  notes: string | null;
  approved: boolean;
  /** ISO timestamp (UTC) of the last time the approval checkbox changed; null for imported history. */
  approved_at: string | null;
};

export const hasPaymentData = (p: PaymentRow) =>
  p.approved || [p.homepay_earnings, p.homepay_net, p.homepay_date, p.personal_paid, p.personal_date, p.route, p.notes].some((v) => v !== null && v !== "");

export type Period = {
  id: string;
  start: string;
  end: string;
  worked: number;
  vacation: number;
  sick: number;
  holiday: number;
  stipend: number;
  expenses: number;
  total: number;
  ot: number;
  personalDue: number;
  payment: PaymentRow | null;
  homepayNet: number;
  personalPaid: number;
  totalPaid: number;
  approved: boolean;
};

const hoursOf = (h: number, m: number) => h + m / 60;
export const workedHours = (d: DayRow) => hoursOf(d.wh, d.wm);
export const vacationHours = (d: DayRow) => hoursOf(d.vh, d.vm);
export const sickHours = (d: DayRow) => hoursOf(d.sh, d.sm);
export const holidayHours = (d: DayRow) => hoursOf(d.hh, d.hm);
export const totalHours = (d: DayRow) => workedHours(d) + vacationHours(d) + sickHours(d) + holidayHours(d);

export function buildPeriods(days: DayRow[], payments: PaymentRow[], settings: Settings = DEFAULT_SETTINGS): Period[] {
  const byStart = new Map<string, Period>();
  const payMap = new Map(payments.filter(hasPaymentData).map((p) => [p.period_start, p]));

  const ensure = (start: string): Period => {
    let p = byStart.get(start);
    if (!p) {
      p = {
        id: periodId(start),
        start,
        end: addDays(start, 6),
        worked: 0, vacation: 0, sick: 0, holiday: 0, stipend: 0, expenses: 0,
        total: 0, ot: 0, personalDue: 0,
        payment: payMap.get(start) ?? null,
        homepayNet: 0, personalPaid: 0, totalPaid: 0, approved: false,
      };
      byStart.set(start, p);
    }
    return p;
  };

  for (const d of days) {
    const p = ensure(periodStart(d.date));
    p.worked += workedHours(d);
    p.vacation += vacationHours(d);
    p.sick += sickHours(d);
    p.holiday += holidayHours(d);
    p.stipend += d.stipend;
    p.expenses += d.expenses;
  }
  for (const start of payMap.keys()) ensure(start);

  const out = [...byStart.values()];
  for (const p of out) {
    p.total = p.worked + p.vacation + p.sick + p.holiday;
    p.ot = Math.max(p.total - settings.otThreshold, 0);
    p.personalDue = p.ot * settings.otRate + p.stipend + p.expenses;
    p.homepayNet = p.payment?.homepay_net ?? 0;
    p.personalPaid = p.payment?.personal_paid ?? 0;
    p.totalPaid = p.homepayNet + p.personalPaid;
    p.approved = p.payment?.approved ?? false;
  }
  return out
    .filter((p) => p.total > 0 || p.stipend > 0 || p.expenses > 0 || p.payment)
    .sort((a, b) => (a.start < b.start ? 1 : -1));
}

/* ---------- settlement status ---------- */

export type Badge = { label: string; tone: "ok" | "warn" | "neutral" };
export type PeriodStatus = { open: boolean; approved: boolean; balanced: boolean; outstanding: number; badges: Badge[] };

/**
 * One definition of status for the whole app. A closed period carries two independent badges:
 * whether its hours are approved, and whether it is balanced: Homepay paid for any hours,
 * and personal pay made equal to personal pay due.
 */
export function periodStatus(
  p: { end: string; total: number; homepayNet: number; personalDue: number; personalPaid: number; approved: boolean },
  today: string,
): PeriodStatus {
  const outstanding = p.personalDue - p.personalPaid;
  const personalBalanced = Math.abs(outstanding) < 0.005;
  const homepayMissing = p.total > 0 && p.homepayNet <= 0;
  const balanced = personalBalanced && !homepayMissing;
  if (p.end >= today) return { open: true, approved: p.approved, balanced, outstanding, badges: [{ label: "open", tone: "neutral" }] };
  const badges: Badge[] = [
    p.approved ? { label: "hours approved", tone: "ok" } : { label: "hours not approved", tone: "warn" },
    balanced ? { label: "balanced", tone: "ok" } : { label: "unbalanced", tone: "warn" },
  ];
  return { open: false, approved: p.approved, balanced, outstanding, badges };
}

export const needsAttention = (s: PeriodStatus) => !s.open && (!s.approved || !s.balanced);

/* ---------- pay period detail ---------- */

export type Scheduled = { minutes: number; open: number };

/** Everything the pay period popup shows; plain data so server pages can hand it to client components. */
export type PeriodDetail = { period: Period; status: PeriodStatus; scheduled: Scheduled | null; otRate: number; otThreshold: number };

export const periodDetail = (period: Period, today: string, settings: Settings, scheduled: Scheduled | null): PeriodDetail => ({
  period, status: periodStatus(period, today), scheduled, otRate: settings.otRate, otThreshold: settings.otThreshold,
});

/* ---------- grouping for the summary tables ---------- */

export type Group = "period" | "month" | "ytd" | "year";
export const GROUPS: { key: Group; label: string }[] = [
  { key: "period", label: "Pay period" },
  { key: "month", label: "Month" },
  { key: "ytd", label: "Year to date" },
  { key: "year", label: "Calendar year" },
];

export type HoursRow = { key: string; label: string; working: number; vacation: number; sick: number; holiday: number; total: number; ot: number | null };
export type PaymentsRow = { key: string; label: string; hours: number; earnings: number; homepay: number; due: number; paid: number; owed: number; totalPaid: number };

const monthLabel = (ym: string) =>
  new Date(parse(`${ym}-01`)).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

const periodLabel = (p: { start: string; end: string }) => `${fmtDate(p.start)} – ${fmtDate(p.end)}`;

/** Hours group by each day's own date (month, ytd, year); pay periods use the period totals. */
export function hoursRows(days: DayRow[], periods: Period[], group: Group, today: string): HoursRow[] {
  if (group === "period") {
    return periods.map((p) => ({
      key: p.start, label: periodLabel(p), working: p.worked, vacation: p.vacation, sick: p.sick, holiday: p.holiday, total: p.total, ot: p.ot,
    }));
  }
  const year = today.slice(0, 4);
  const keyOf = (date: string) => (group === "month" ? date.slice(0, 7) : group === "year" ? date.slice(0, 4) : year);
  const map = new Map<string, HoursRow>();
  for (const d of days) {
    if (group === "ytd" && (d.date.slice(0, 4) !== year || d.date > today)) continue;
    const key = keyOf(d.date);
    let r = map.get(key);
    if (!r) {
      const label = group === "month" ? monthLabel(key) : group === "year" ? key : `${key} to date`;
      r = { key, label, working: 0, vacation: 0, sick: 0, holiday: 0, total: 0, ot: null };
      map.set(key, r);
    }
    r.working += workedHours(d);
    r.vacation += vacationHours(d);
    r.sick += sickHours(d);
    r.holiday += holidayHours(d);
    r.total += totalHours(d);
  }
  return [...map.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}

/** Payments group by pay period end date (month, ytd, year). */
export function paymentsRows(periods: Period[], group: Group, today: string): PaymentsRow[] {
  const year = today.slice(0, 4);
  const map = new Map<string, PaymentsRow>();
  for (const p of periods) {
    // only pay periods that END inside the range count; year to date stops at today
    if (group === "ytd" && (p.end.slice(0, 4) !== year || p.end > today)) continue;
    const key = group === "period" ? p.start : group === "month" ? p.end.slice(0, 7) : group === "year" ? p.end.slice(0, 4) : year;
    let r = map.get(key);
    if (!r) {
      const label = group === "period" ? periodLabel(p) : group === "month" ? monthLabel(key) : group === "year" ? key : `${key} to date`;
      r = { key, label, hours: 0, earnings: 0, homepay: 0, due: 0, paid: 0, owed: 0, totalPaid: 0 };
      map.set(key, r);
    }
    r.hours += p.total;
    r.earnings += p.payment?.homepay_earnings ?? 0;
    r.homepay += p.homepayNet;
    r.due += p.personalDue;
    r.paid += p.personalPaid;
    r.owed += p.personalDue - p.personalPaid;
    r.totalPaid += p.totalPaid;
  }
  return [...map.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}

/* ---------- formatting ---------- */

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

/** "10/24/2026 3:12 PM" in Eastern time, from an ISO timestamp. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York", month: "numeric", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  }).replace(",", "");
}

/** "9:30 AM" in Eastern time, from an ISO timestamp. */
export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
}

/** "9:30 AM" from a local wall-clock string ("2026-10-26T09:30:00"); no zone conversion happens. */
export function fmtLocalTime(local: string): string {
  return fmtClock(local.slice(11, 16));
}

/** "9:30 AM" from "09:30" ("24:00" is midnight at the end of the day). */
export function fmtClock(hhmm: string): string {
  const h = Number(hhmm.slice(0, 2));
  return `${h % 12 || 12}:${hhmm.slice(3, 5)} ${h < 12 || h === 24 ? "AM" : "PM"}`;
}

export function fmtDow(s: string): string {
  return new Date(parse(s)).toLocaleString("en-US", { weekday: "short", timeZone: "UTC" });
}

export function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}
