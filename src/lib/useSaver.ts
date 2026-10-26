"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type Entry<T> = { data: T; timer?: ReturnType<typeof setTimeout> };

/**
 * Debounced autosave keyed by record. Saves are serialised per key (latest value wins),
 * failed saves are retried until they succeed, and anything pending is flushed when the
 * tab is hidden or closed. The browser warns before leaving while changes are unsaved.
 */
export function useSaver<T>(url: string, delay = 600) {
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({});
  const pending = useRef(new Map<string, Entry<T>>());
  const inflight = useRef(new Set<string>());
  const flushRef = useRef<(key: string) => void>(() => {});

  const setStatus = useCallback((key: string, s: SaveStatus) => setStatuses((p) => (p[key] === s ? p : { ...p, [key]: s })), []);

  const flush = useCallback(
    async (key: string) => {
      const entry = pending.current.get(key);
      if (!entry) return;
      if (entry.timer) clearTimeout(entry.timer);
      if (inflight.current.has(key)) {
        entry.timer = setTimeout(() => flushRef.current(key), 250);
        return;
      }
      pending.current.delete(key);
      inflight.current.add(key);
      setStatus(key, "saving");
      try {
        const res = await fetch(url, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(entry.data),
          keepalive: true,
        });
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        setStatus(key, pending.current.has(key) ? "saving" : "saved");
      } catch {
        if (!pending.current.has(key)) {
          pending.current.set(key, { data: entry.data, timer: setTimeout(() => flushRef.current(key), 4000) });
        }
        setStatus(key, "error");
      } finally {
        inflight.current.delete(key);
      }
    },
    [url, setStatus],
  );
  flushRef.current = flush;

  const queue = useCallback(
    (key: string, data: T) => {
      const prev = pending.current.get(key);
      if (prev?.timer) clearTimeout(prev.timer);
      pending.current.set(key, { data, timer: setTimeout(() => flushRef.current(key), delay) });
      setStatus(key, "saving");
    },
    [delay, setStatus],
  );

  const flushAll = useCallback(() => {
    for (const key of [...pending.current.keys()]) flushRef.current(key);
  }, []);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushAll();
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      flushAll();
      if (pending.current.size > 0 || inflight.current.size > 0) e.preventDefault();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushAll);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushAll);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [flushAll]);

  return { statuses, queue, flush, flushAll };
}
