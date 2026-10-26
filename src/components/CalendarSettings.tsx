"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fmtDateTime } from "@/lib/calc";
import type { Calendar } from "@/lib/calendar";

type SyncResult = { ok: boolean; error?: string; count?: number };

export default function CalendarSettings({ calendars, editable }: { calendars: Calendar[]; editable: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [add, setAdd] = useState({ label: "", url: "", color: "#2f5d9e" });

  async function call(tag: string, url: string, method: string, body?: unknown) {
    setBusy(tag);
    setMsg(null);
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(json.error ?? "Something went wrong");
        return false;
      }
      const sync = json.sync as SyncResult | undefined;
      if (sync && !sync.ok) setMsg(`Saved, but the first sync failed: ${sync.error}`);
      router.refresh();
      return true;
    } catch {
      setMsg("Network error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h2 className="h2">Calendars</h2>
      {calendars.length === 0 && <p className="muted small">No calendars yet.</p>}
      {calendars.map((c) => (
        <CalendarRow key={`${c.id}-${c.label}-${c.color}-${c.enabled}`} c={c} editable={editable} busy={busy} call={call} />
      ))}
      {editable && (
        <form
          className="addcal"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await call("add", "/api/calendars", "POST", add)) setAdd({ label: "", url: "", color: add.color });
          }}
        >
          <h3 className="h3">Add a calendar</h3>
          <div className="field">
            <label htmlFor="cl">Name</label>
            <input id="cl" type="text" value={add.label} onChange={(e) => setAdd({ ...add, label: e.target.value })} placeholder="School, Family…" maxLength={60} />
          </div>
          <div className="field">
            <label htmlFor="cu">iCal URL</label>
            <input id="cu" type="url" value={add.url} onChange={(e) => setAdd({ ...add, url: e.target.value })} placeholder="https://… or webcal://…" autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="cc">Color</label>
            <input id="cc" type="color" value={add.color} onChange={(e) => setAdd({ ...add, color: e.target.value })} />
          </div>
          <div className="savebar">
            <button className="primary" type="submit" disabled={busy !== null || !add.label.trim() || !add.url.trim()}>{busy === "add" ? "Adding…" : "Add calendar"}</button>
          </div>
          <p className="muted small">Secret iCal addresses work like passwords: they are stored on the server and only shown here in masked form.</p>
        </form>
      )}
      {msg && <p className="err small">{msg}</p>}
    </div>
  );
}

function CalendarRow({
  c, editable, busy, call,
}: {
  c: Calendar;
  editable: boolean;
  busy: string | null;
  call: (tag: string, url: string, method: string, body?: unknown) => Promise<boolean>;
}) {
  const [label, setLabel] = useState(c.label);
  const [url, setUrl] = useState("");
  const tag = `c${c.id}`;
  const off = busy !== null;

  return (
    <div className={c.enabled ? "calrow" : "calrow off"}>
      <div className="calhead">
        {editable ? (
          <input type="color" value={c.color} aria-label="Color" onChange={(e) => call(tag, `/api/calendars/${c.id}`, "PATCH", { color: e.target.value })} />
        ) : (
          <span className="swatch" style={{ background: c.color }} />
        )}
        {editable ? (
          <input type="text" className="callabel" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)}
            onBlur={() => label.trim() && label !== c.label && call(tag, `/api/calendars/${c.id}`, "PATCH", { label })} />
        ) : (
          <strong>{c.label}</strong>
        )}
        {!c.enabled && <span className="pill">off</span>}
      </div>
      <div className="muted small">
        {c.last_error ? <span className="err">Sync failed: {c.last_error}</span> : c.last_synced ? `Synced ${fmtDateTime(c.last_synced)}` : "Not synced yet"}
        {editable && <> · <code>{c.url_masked}</code></>}
      </div>
      {editable && (
        <>
          <div className="field">
            <label htmlFor={`u${c.id}`}>Replace URL</label>
            <input id={`u${c.id}`} type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a new address to change" autoComplete="off" />
          </div>
          <div className="savebar">
            {url.trim() && <button className="small primary" disabled={off} onClick={async () => (await call(tag, `/api/calendars/${c.id}`, "PATCH", { url })) && setUrl("")}>Save URL</button>}
            <button className="small" disabled={off} onClick={() => call(tag, "/api/calendars/sync", "POST", { id: c.id })}>{busy === tag ? "Working…" : "Sync now"}</button>
            <button className="small" disabled={off} onClick={() => call(tag, `/api/calendars/${c.id}`, "PATCH", { enabled: !c.enabled })}>{c.enabled ? "Turn off" : "Turn on"}</button>
            <button
              className="small danger" disabled={off}
              onClick={() => window.confirm(`Remove "${c.label}" and its imported events?`) && call(tag, `/api/calendars/${c.id}`, "DELETE")}
            >
              Remove
            </button>
          </div>
        </>
      )}
    </div>
  );
}
