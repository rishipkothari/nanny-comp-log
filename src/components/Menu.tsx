"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const items = [
  { href: "/", label: "Timesheet" },
  { href: "/summary", label: "Summary" },
  { href: "/payments", label: "Payments" },
  { href: "/settings", label: "Settings" },
];

export default function Menu({ admin }: { admin: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const current = items.find((i) => (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)));

  return (
    <>
      <header className="topbar">
        <button className="hamburger" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="toptitle">{current?.label ?? "Nanny Comp Log"}</span>
        {admin && <span className="pill adminpill">Admin</span>}
      </header>

      {open && (
        <div className="scrim" onClick={() => setOpen(false)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Menu">
            <div className="drawerhead">
              <strong>Nanny Comp Log</strong>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="small">✕</button>
            </div>
            <nav>
              {items.map((i) => (
                <Link key={i.href} href={i.href} className={i === current ? "on" : ""}>
                  {i.label}
                </Link>
              ))}
            </nav>
            <div className="drawerfoot">
              {admin ? (
                <form method="post" action="/api/admin/logout">
                  <button type="submit">Lock admin mode</button>
                </form>
              ) : (
                <Link href="/admin" className="btn">Unlock admin mode</Link>
              )}
              <form method="post" action="/api/logout">
                <button type="submit">Log out</button>
              </form>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
