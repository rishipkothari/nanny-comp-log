import Link from "next/link";

const tabs = [
  { href: "/", label: "Timesheet", key: "timesheet" },
  { href: "/summary", label: "Summary", key: "summary" },
  { href: "/trends", label: "Trends", key: "trends" },
];

export default function Nav({ active }: { active: string }) {
  return (
    <nav className="nav">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} className={t.key === active ? "on" : ""}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
