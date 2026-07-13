"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  UserPlusIcon,
  TargetIcon,
  FlaskConicalIcon,
  MonitorIcon,
  HashIcon,
  PackageIcon,
  BoxesIcon,
  WarehouseIcon,
  Building2Icon,
  ShoppingCartIcon,
  ClipboardListIcon,
  FileTextIcon,
  LandmarkIcon,
  TagIcon,
  ShieldCheckIcon,
  CoinsIcon,
  BookOpenIcon,
  FactoryIcon,
  WrenchIcon,
  StethoscopeIcon,
  ArrowLeftRightIcon,
  ClipboardCheckIcon,
  MapPinIcon,
  HammerIcon,
  ReceiptIcon,
  ScrollTextIcon,
  PackagePlusIcon,
  PlugIcon,
  CalendarClockIcon,
  LifeBuoyIcon,
} from "lucide-react";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/leads", label: "Leads", icon: UserPlusIcon },
  { href: "/opportunities", label: "Opportunities", icon: TargetIcon },
  { href: "/labs", label: "Labs", icon: FlaskConicalIcon },
  { href: "/devices", label: "Devices", icon: MonitorIcon },
  { href: "/serials", label: "Serials", icon: HashIcon },
  { href: "/maintenance-visits", label: "Maintenance", icon: StethoscopeIcon },
  { href: "/maintenance-schedules", label: "PM Schedules", icon: CalendarClockIcon },
  { href: "/asset-movements", label: "Movements", icon: MapPinIcon },
  { href: "/installation-notes", label: "Installations", icon: PlugIcon },
  { href: "/asset-repairs", label: "Repairs", icon: HammerIcon },
  { href: "/kits", label: "Kits", icon: BoxesIcon },
  { href: "/boms", label: "BOMs", icon: FactoryIcon },
  { href: "/work-orders", label: "Work Orders", icon: WrenchIcon },
  { href: "/quality-inspections", label: "Quality", icon: ClipboardCheckIcon },
  { href: "/products", label: "Products", icon: PackageIcon },
  { href: "/product-bundles", label: "Bundles", icon: PackagePlusIcon },
  { href: "/prices", label: "Prices", icon: TagIcon },
  { href: "/warehouses", label: "Warehouses", icon: WarehouseIcon },
  { href: "/stock-entries", label: "Stock Entries", icon: ArrowLeftRightIcon },
  { href: "/companies", label: "Companies", icon: Building2Icon },
  { href: "/quotations", label: "Quotations", icon: FileTextIcon },
  { href: "/sales-orders", label: "Sales Orders", icon: ClipboardListIcon },
  { href: "/sales-invoices", label: "Sales Invoices", icon: ReceiptIcon },
  { href: "/purchase-orders", label: "Purchase Orders", icon: ScrollTextIcon },
  { href: "/purchases", label: "Purchases", icon: ShoppingCartIcon },
  { href: "/warranty", label: "Warranty", icon: ShieldCheckIcon },
  { href: "/issues", label: "Support", icon: LifeBuoyIcon },
  { href: "/banking", label: "Banking", icon: LandmarkIcon },
  { href: "/accounts", label: "Accounts", icon: BookOpenIcon },
  { href: "/currency", label: "Currency", icon: CoinsIcon },
];

export function AppNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {nav.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-surface-gray-2 text-ink-gray-8"
                : "text-ink-gray-6 hover:bg-surface-gray-1 hover:text-ink-gray-8"
            }`}
          >
            <Icon size={16} className={active ? "text-brand" : "text-ink-gray-5"} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
