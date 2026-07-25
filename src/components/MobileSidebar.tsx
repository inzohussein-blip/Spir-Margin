"use client";

import { useState, type ReactNode } from "react";
import { MenuIcon, XIcon } from "lucide-react";

/**
 * Mobile-only navigation drawer. The desktop sidebar is hidden below `md`;
 * this hamburger reveals the same nav panel as a slide-in overlay. Additive —
 * it renders nothing on desktop and does not touch the desktop shell.
 */
export function MobileSidebar({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menu"
        className="rounded-md border border-outline-gray-2 p-2 text-ink-gray-6 hover:bg-surface-gray-1"
      >
        <MenuIcon size={18} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 flex w-72 max-w-[82%] flex-col overflow-y-auto bg-surface-white shadow-xl">
            <div className="flex justify-end p-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-2 text-ink-gray-6 hover:bg-surface-gray-1"
              >
                <XIcon size={18} />
              </button>
            </div>
            {/* Closing on any click lets a nav link dismiss the drawer. */}
            <div onClick={() => setOpen(false)}>{children}</div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
