import {
  LayoutDashboardIcon, UserPlusIcon, TargetIcon, FlaskConicalIcon, MonitorIcon,
  HashIcon, PackageIcon, BoxesIcon, WarehouseIcon, Building2Icon, ShoppingCartIcon,
  ClipboardListIcon, FileTextIcon, LandmarkIcon, TagIcon, ShieldCheckIcon, CoinsIcon,
  BookOpenIcon, FactoryIcon, WrenchIcon, StethoscopeIcon, ArrowLeftRightIcon,
  ClipboardCheckIcon, MapPinIcon, HammerIcon, ReceiptIcon, ScrollTextIcon,
  PackagePlusIcon, PlugIcon, CalendarClockIcon, LifeBuoyIcon, FileSignatureIcon,
  CalendarDaysIcon, UsersIcon, CreditCardIcon, PercentIcon, ListChecksIcon,
  BarChart3Icon, TrendingUpIcon,
  type LucideIcon,
} from "lucide-react";

export interface NavItem { href: string; label: string; icon: LucideIcon; }
export interface NavGroup { label: string; items: NavItem[]; }

/** Sidebar workspaces (module groups), also used by the awesomebar + workspace pages. */
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
    { href: "/blanket-orders", label: "Blanket Orders", icon: FileSignatureIcon },
    { href: "/credit-limits", label: "Credit Limits", icon: CreditCardIcon },
    { href: "/pricing-rules", label: "Pricing Rules", icon: PercentIcon },
  ]},
  { label: "Buying", items: [
    { href: "/companies", label: "Suppliers", icon: Building2Icon },
    { href: "/rfqs", label: "RFQs", icon: FileTextIcon },
    { href: "/purchase-orders", label: "Purchase Orders", icon: ScrollTextIcon },
    { href: "/purchase-receipts", label: "Purchase Receipts", icon: PackagePlusIcon },
    { href: "/purchases", label: "Purchases", icon: ShoppingCartIcon },
  ]},
  { label: "Stock", items: [
    { href: "/products", label: "Products", icon: PackageIcon },
    { href: "/product-bundles", label: "Bundles", icon: PackagePlusIcon },
    { href: "/kits", label: "Kits", icon: BoxesIcon },
    { href: "/serials", label: "Serials", icon: HashIcon },
    { href: "/warehouses", label: "Warehouses", icon: WarehouseIcon },
    { href: "/stock-entries", label: "Stock Entries", icon: ArrowLeftRightIcon },
    { href: "/pick-lists", label: "Pick Lists", icon: ClipboardCheckIcon },
    { href: "/delivery-trips", label: "Delivery Trips", icon: MapPinIcon },
    { href: "/stock-balance", label: "Stock Balance", icon: ClipboardListIcon },
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
    { href: "/payment-requests", label: "Payment Requests", icon: CreditCardIcon },
    { href: "/banking", label: "Banking", icon: LandmarkIcon },
    { href: "/accounts", label: "Accounts", icon: BookOpenIcon },
    { href: "/currency", label: "Currency", icon: CoinsIcon },
  ]},
  { label: "Reports", items: [
    { href: "/reports", label: "All Reports", icon: BarChart3Icon },
    { href: "/reports/receivables", label: "Receivables Aging", icon: CoinsIcon },
    { href: "/reports/profitability", label: "Profitability", icon: TrendingUpIcon },
    { href: "/stock-balance", label: "Stock Balance", icon: ClipboardListIcon },
  ]},
  { label: "Setup", items: [
    { href: "/masters", label: "Masters", icon: ListChecksIcon },
    { href: "/users", label: "Users", icon: UsersIcon },
  ]},
];

/** Flat destination list for the awesomebar. */
export const allNavItems: NavItem[] = navGroups.flatMap((g) => g.items);
