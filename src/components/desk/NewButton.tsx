"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

// Common create targets, Frappe-Desk "+ New" style.
const CREATE = [
  { href: "/labs/new", label: "Lab" },
  { href: "/quotations/new", label: "Quotation" },
  { href: "/sales-orders/new", label: "Sales Order" },
  { href: "/sales-invoices/new", label: "Sales Invoice" },
  { href: "/purchase-orders/new", label: "Purchase Order" },
  { href: "/purchase-receipts/new", label: "Purchase Receipt" },
  { href: "/products/new", label: "Product" },
  { href: "/devices/new", label: "Device" },
  { href: "/issues/new", label: "Issue" },
];

export function NewButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
      >
        <PlusIcon size={15} /> <span className="hidden sm:inline">Create</span>
      </button>
      {open ? (
        <div className="absolute left-0 z-50 mt-1 w-52 overflow-hidden rounded-md border border-outline-gray-2 bg-surface-white py-1 shadow-lg">
          <p className="px-3 py-1 text-xs uppercase tracking-wide text-ink-gray-4">Create new</p>
          {CREATE.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              onClick={() => setOpen(false)}
              className="block px-3 py-1.5 text-sm text-ink-gray-7 hover:bg-surface-gray-1 hover:text-ink-gray-9"
            >
              {c.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
