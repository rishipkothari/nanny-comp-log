"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A popup on a native modal <dialog>, portalled to <body> so it can be opened from anywhere,
 * table rows included. Escape, ✕ and a tap on the backdrop all close it through onClose.
 */
export default function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open, mounted]);

  if (!mounted) return null;
  return createPortal(
    <dialog
      ref={ref}
      className="detail"
      onClose={onClose}
      onClick={(e) => {
        // React bubbles portal events to the opener (a card or row that opens on click); keep them here
        e.stopPropagation();
        // a click on the backdrop lands on the dialog element itself
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      {open && children}
    </dialog>,
    document.body,
  );
}
