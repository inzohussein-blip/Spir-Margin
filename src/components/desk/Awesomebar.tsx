"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, PlusIcon, ArrowRightIcon } from "lucide-react";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { allNavItems } from "@/lib/nav";

// Routes that have a /new create form (mirrors the app's create pages).
const HAS_NEW = new Set([
  "/leads", "/opportunities", "/appointments", "/contracts", "/labs", "/quotations",
  "/sales-orders", "/sales-invoices", "/pricing-rules", "/rfqs", "/purchase-orders",
  "/purchases", "/products", "/product-bundles", "/serials", "/warehouses", "/stock-entries",
  "/boms", "/work-orders", "/quality-inspections", "/devices", "/asset-movements",
  "/installation-notes", "/asset-repairs", "/maintenance-visits", "/maintenance-schedules",
  "/maintenance-teams", "/issues", "/warranty", "/accounts",
]);

/** ERPNext-style awesomebar: ⌘K global command palette to jump to any list or
 *  start a new document. */
export function Awesomebar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-72 max-w-full items-center gap-2 rounded-md border border-outline-gray-2 bg-surface-gray-1 px-3 py-1.5 text-sm text-ink-gray-4 hover:border-outline-gray-3"
      >
        <SearchIcon size={15} />
        <span className="flex-1 text-left">Search or jump to…</span>
        <kbd className="rounded border border-outline-gray-2 bg-surface-white px-1.5 text-2xs text-ink-gray-5">⌘K</kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search lists, or type 'new'…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Go to">
            {allNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem key={item.href} value={`goto ${item.label}`} onSelect={() => go(item.href)}>
                  <Icon size={15} className="text-ink-gray-5" />
                  <span>{item.label}</span>
                  <ArrowRightIcon size={13} className="ml-auto text-ink-gray-3" />
                </CommandItem>
              );
            })}
          </CommandGroup>
          <CommandGroup heading="Create new">
            {allNavItems
              .filter((i) => HAS_NEW.has(i.href))
              .map((item) => (
                <CommandItem key={`new-${item.href}`} value={`new ${item.label}`} onSelect={() => go(`${item.href}/new`)}>
                  <PlusIcon size={15} className="text-ink-gray-5" />
                  <span>New {item.label.replace(/s$/, "")}</span>
                </CommandItem>
              ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
