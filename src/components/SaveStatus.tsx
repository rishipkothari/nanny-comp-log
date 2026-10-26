import type { SaveStatus as Status } from "@/lib/useSaver";

export default function SaveStatus({ status, compact = false }: { status: Status | undefined; compact?: boolean }) {
  if (!status || status === "idle") return compact ? <span className="ss" /> : <span className="ss muted">Changes save automatically</span>;
  if (status === "saving") return <span className="ss muted">{compact ? "…" : "Saving…"}</span>;
  if (status === "saved") return <span className="ss saved">{compact ? "✓" : "Saved ✓"}</span>;
  return <span className="ss err">{compact ? "!" : "Couldn’t save, retrying…"}</span>;
}
