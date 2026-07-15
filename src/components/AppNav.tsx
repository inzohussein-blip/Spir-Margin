"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon, UserPlusIcon, TargetIcon, FlaskConicalIcon, MonitorIcon,
  HashIcon, PackageIcon, BoxesIcon, WarehouseIcon, Building2Icon, ShoppingCartIcon,
  ClipboardListIcon, FileTextIcon, LandmarkIcon, TagIcon, ShieldCheckIcon, CoinsIcon,
  BookOpenIcon, FactoryIcon, WrenchIcon, StethoscopeIcon, ArrowLeftRightIcon,
  ClipboardCheckIcon, MapPinIcon, HammerIcon, ReceiptIcon, ScrollTextIcon,
  PackagePlusIcon, PlugIcon, CalendarClockIcon, LifeBuoyIcon, FileSignatureIcon,
  CalendarDaysIcon, UsersIcon, CreditCardIcon, PercentIcon, ListChecksIcon,
  ChevronRightIcon, type LucideIcon,
} from "lucide-react";

export interface NavItem { href: string; label: string; icon: LucideIcon; }
interface NavGroup { label: string; items: NavItem[]; }

export const navGroups: NavGroup[] = [
  { label: "Home", items: [{ href: "/", label: "Dashboard", icon: LayoutDashboardIcon }] },
  { label: "CRM", items: [
    { href: "/leads", label: "Leads", icon: UserPlusIcon },
    { href: "/opportunities", label: "Opportunities", icon: TargetIcon },
    { href: "/appointments", label: "Appointments", icon: CalendarDaysIcon },
    { href: "/contracts", label: "Contracts", icon: FileSignatureIcon },
  ]},
  { label: "Selling", items: [
    { href: "/labs", label: "Labs", icon: FlaskConicalIcon },
    { href: "/quotations", label: "Quotations", icon: FileTextIcon },
    { href: "/sales-orders", label: "Sales Orders", icon: ClipboardListIcon },
    { href: "/sales-invoices", label: "Sales Invoices", icon: ReceiptIcon },
    { href: "/credit-limits", label: "Credit Limits", icon: CreditCardIcon },
    { href: "/pricing-rules", label: "Pricing Rules", icon: PercentIcon },
  ]},
  { label: "Buying", items: [
    { href: "/companies", label: "Suppliers", icon: Building2Icon },
    { href: "/rfqs", label: "RFQs", icon: FileTextIcon },
    { href: "/purchase-orders", label: "Purchase Orders", icon: ScrollTextIcon },
    { href: "/purchases", label: "Purchases", icon: ShoppingCartIcon },
  ]},
  { label: "Stock", items: [
    { href: "/products", label: "Products", icon: PackageIcon },
    { href: "/product-bundles", label: "Bundles", icon: PackagePlusIcon },
    { href: "/kits", label: "Kits", icon: BoxesIcon },
    { href: "/serials", label: "Serials", icon: HashIcon },
    { href: "/warehouses", label: "Warehouses", icon: WarehouseIcon },
    { href: "/stock-entries", label: "Stock Entries", icon: ArrowLeftRightIcon },
    { href: "/prices", label: "Prices", icon: TagIcon },
  ]},
  { label: "Manufacturing", items: [
    { href: "/boms", label: "BOMs", icon: FactoryIcon },
    { href: "/work-orders", label: "Work Orders", icon: WrenchIcon },
    { href: "/quality-inspections", label: "Quality", icon: ClipboardCheckIcon },
  ]},
  { label: "Assets", items: [
    { href: "/devices", label: "Devices", icon: MonitorIcon },
    { href: "/asset-movements", label: "Movements", icon: MapPinIcon },
    { href: "/installation-notes", label: "Installations", icon: PlugIcon },
    { href: "/asset-repairs", label: "Repairs", icon: HammerIcon },
  ]},
  { label: "Maintenance", items: [
    { href: "/maintenance-visits", label: "Visits", icon: StethoscopeIcon },
    { href: "/maintenance-schedules", label: "PM Schedules", icon: CalendarClockIcon },
    { href: "/maintenance-teams", label: "Teams", icon: UsersIcon },
  ]},
  { label: "Support", items: [
    { href: "/issues", label: "Issues", icon: LifeBuoyIcon },
    { href: "/warranty", label: "Warranty", icon: ShieldCheckIcon },
  ]},
  { label: "Accounting", items: [
    { href: "/banking", label: "Banking", icon: LandmarkIcon },
    { href: "/accounts", label: "Accounts", icon: BookOpenIcon },
    { href: "/currency", label: "Currency", icon: CoinsIcon },
  ]},
  { label: "Setup", items: [{ href: "/masters", label: "Masters", icon: ListChecksIcon }] },
];

/** Flat destination list for the awesomebar. */
export const allNavItems: NavItem[] = navGroups.flatMap((g) => g.items);

export function AppNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const activeGroup = navGroups.find((g) => g.items.some((i) => isActive(i.href)))?.label;
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <nav className="flex flex-col gap-0.5 px-2 pb-6">
      {navGroups.map((group) => {
        const isSingle = group.items.length === 1;
        const expanded = open[group.label] ?? (group.label === activeGroup || group.label === "Home");
        if (isSingle) {
          const item = group.items[0];
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={group.label}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-surface-gray-2 text-ink-gray-8" : "text-ink-gray-6 hover:bg-surface-gray-1 hover:text-ink-gray-8"
              }`}
            >
              <Icon size={16} className={active ? "text-brand" : "text-ink-gray-5"} />
              {item.label}
            </Link>
          );
        }
        return (
          <div key={group.label} className="mt-1">
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [group.label]: !expanded }))}
              className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-gray-4 hover:text-ink-gray-6"
            >
              {group.label}
              <ChevronRightIcon size={13} className={`transition-transform ${expanded ? "rotate-90" : ""}`} />
            </button>
            {expanded && (
              <div className="mt-0.5 flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 rounded-md py-1.5 pl-6 pr-3 text-sm font-medium transition-colors ${
                        active ? "bg-surface-gray-2 text-ink-gray-8" : "text-ink-gray-6 hover:bg-surface-gray-1 hover:text-ink-gray-8"
                      }`}
                    >
                      <Icon size={15} className={active ? "text-brand" : "text-ink-gray-5"} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
