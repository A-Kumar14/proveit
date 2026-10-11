"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@proveit/lib/cn";

/** The sidebar sits beside the page on a wide screen. On a narrow one it slides in over the page from a menu button. */
export function SidebarFrame({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <button type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="app-sidebar" onClick={() => setOpen((o) => !o)}
        className="glass fixed left-3 top-[13px] z-50 flex size-9 cursor-pointer items-center justify-center rounded-md border text-ink lg:hidden">
        {open ? <X size={17} aria-hidden /> : <Menu size={17} aria-hidden />}
      </button>
      {open && <div aria-hidden onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-black/30 lg:hidden" />}
      {/* A tap on any link inside closes the drawer, since the next page replaces it. */}
      <div id="app-sidebar" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}
        className={cn("fixed inset-y-0 left-0 z-40 flex transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0", open ? "translate-x-0 shadow-xl" : "-translate-x-full")}>
        {children}
      </div>
    </>
  );
}
