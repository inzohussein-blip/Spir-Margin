"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, PlusIcon, ArrowRightIcon, FileTextIcon } from "lucide-react";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { allNavItems } from "@/lib/nav";
import { globalSearch, type SearchHit } from "@/app/actions/search";
import { t, type Locale } from "@/lib/i18n";

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
export function Awesomebar({ locale = "ar" }: { locale?: Locale }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);

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

  // Debounced record search across the main documents.
  useEffect(() => {
    if (query.trim().length < 2) { setHits([]); return; }
    let active = true;
    const t = setTimeout(async () => {
      const res = await globalSearch(query);
      if (active) setHits(res);
    }, 200);
    return () => { active = false; clearTimeout(t); };
  }, [query]);

  // Reset the query when the palette closes.
  useEffect(() => { if (!open) { setQuery(""); setHits([]); } }, [open]);

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
        <span className="flex-1 text-start">{t(locale, "Search or jump to…")}</span>
        <kbd className="rounded border border-outline-gray-2 bg-surface-white px-1.5 text-2xs text-ink-gray-5">⌘K</kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput value={query} onValueChange={setQuery} placeholder={t(locale, "Search records, lists, or type 'new'…")} />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          {hits.length > 0 && (
            <CommandGroup heading={t(locale, "Records")}>
              {hits.map((h) => (
                <CommandItem key={`${h.entity}-${h.href}-${h.label}`} value={`record ${query} ${h.label} ${h.sublabel ?? ""}`} onSelect={() => go(h.href)}>
                  <FileTextIcon size={15} className="text-ink-gray-5" />
                  <span>{h.label}</span>
                  {h.sublabel ? <span className="text-xs text-ink-gray-4">· {h.sublabel}</span> : null}
                  <span className="ml-auto rounded bg-surface-gray-2 px-1.5 py-0.5 text-2xs uppercase text-ink-gray-5">{h.entityLabel}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading={t(locale, "Go to")}>
            {allNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem key={item.href} value={`goto ${item.label} ${t(locale, item.label)}`} onSelect={() => go(item.href)}>
                  <Icon size={15} className="text-ink-gray-5" />
                  <span>{t(locale, item.label)}</span>
                  <ArrowRightIcon size={13} className="ml-auto text-ink-gray-3" />
                </CommandItem>
              );
            })}
          </CommandGroup>
          <CommandGroup heading={t(locale, "Create new")}>
            {allNavItems
              .filter((i) => HAS_NEW.has(i.href))
              .map((item) => (
                <CommandItem key={`new-${item.href}`} value={`new ${item.label} ${t(locale, item.label)}`} onSelect={() => go(`${item.href}/new`)}>
                  <PlusIcon size={15} className="text-ink-gray-5" />
                  <span>{t(locale, item.label)}</span>
                </CommandItem>
              ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
