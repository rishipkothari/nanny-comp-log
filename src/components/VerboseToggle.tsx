"use client";

import { useState } from "react";

/** A "Verbose" checkbox that reveals the `.vdetail` parts of its children; off on every visit. */
export default function VerboseToggle({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  return (
    <>
      <label className="check verbosebox">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
        Verbose (show how each day was deduced)
      </label>
      <div className={on ? "verbose" : ""}>{children}</div>
    </>
  );
}
