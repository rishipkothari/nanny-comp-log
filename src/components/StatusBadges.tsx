import type { PeriodStatus } from "@/lib/calc";

export default function StatusBadges({ status }: { status: PeriodStatus }) {
  return (
    <span className="badges">
      {status.badges.map((b) => (
        <span key={b.label} className={b.tone === "ok" ? "pill ok" : b.tone === "warn" ? "pill warn" : "pill"}>{b.label}</span>
      ))}
    </span>
  );
}
