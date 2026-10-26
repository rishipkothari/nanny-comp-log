import Link from "next/link";
import CalendarSettings from "@/components/CalendarSettings";
import SettingsForm from "@/components/SettingsForm";
import { listCalendars } from "@/lib/calendar";
import { getSettings } from "@/lib/db";
import { isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, calendars, admin] = await Promise.all([getSettings(), listCalendars(), isAdmin()]);
  return (
    <>
      <h1>Settings</h1>
      {admin ? (
        <p className="muted small">Admin mode is on. Changes save automatically and recalculate every total.</p>
      ) : (
        <p className="muted small">
          View only. <Link href="/admin?next=/settings">Unlock admin mode</Link> to edit.
        </p>
      )}
      <SettingsForm key={String(admin)} initial={settings} editable={admin} />
      <CalendarSettings calendars={calendars} editable={admin} />
    </>
  );
}
