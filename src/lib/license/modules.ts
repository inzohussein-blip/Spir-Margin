/**
 * The stations an activation code can open («المحطات»), Spir-Margin's own.
 *
 * Each station is a bundle of sidebar groups (src/lib/nav.ts). A code opens a
 * set of stations; the groups of a station it does not open are hidden on
 * that computer, for every account. Home, Monitoring and Setup belong to no
 * station and are always there. Self-contained (no imports): the codes
 * server, the welcome page, the feature layer and the tests share it.
 */

export interface Station {
  id: string;
  /** English key, shown through t(). */
  label: string;
  /** English key: what the station is for. */
  desc: string;
  /** The sidebar groups it opens. */
  groups: string[];
  /** Where its card leads (a workspace page). */
  href: string;
  /** Card colours, from the app's palette (Tailwind classes, spelled out so the build keeps them). */
  tone: { ring: string; icon: string; button: string; soft: string };
}

export const STATIONS: Station[] = [
  {
    id: "sales",
    label: "Sales & customers",
    desc: "Point of sale, quotations, orders, invoices, returns and the customers' labs.",
    groups: ["Shortcuts", "CRM", "Selling"],
    href: "/w/selling",
    tone: { ring: "border-brand/40 hover:border-brand", icon: "from-brand to-brand-dark", button: "bg-brand hover:bg-brand-dark", soft: "bg-brand-light text-brand-dark" },
  },
  {
    id: "supply",
    label: "Purchasing & stock",
    desc: "Suppliers, purchase orders and receipts, warehouses, kit batches and expiry.",
    groups: ["Buying", "Stock"],
    href: "/w/stock",
    tone: { ring: "border-amber-300 hover:border-amber-500", icon: "from-amber-500 to-amber-700", button: "bg-amber-600 hover:bg-amber-700", soft: "bg-amber-50 text-amber-700" },
  },
  {
    id: "service",
    label: "Devices & maintenance",
    desc: "Installed devices, installations, repairs, maintenance visits, warranty and support tickets.",
    groups: ["Assets", "Maintenance", "Support"],
    href: "/w/maintenance",
    tone: { ring: "border-teal-300 hover:border-teal-500", icon: "from-teal-500 to-teal-700", button: "bg-teal-600 hover:bg-teal-700", soft: "bg-teal-50 text-teal-700" },
  },
  {
    id: "manufacturing",
    label: "Manufacturing & quality",
    desc: "Bills of materials, work orders and quality inspections.",
    groups: ["Manufacturing"],
    href: "/w/manufacturing",
    tone: { ring: "border-rose-300 hover:border-rose-500", icon: "from-rose-500 to-rose-700", button: "bg-rose-600 hover:bg-rose-700", soft: "bg-rose-50 text-rose-700" },
  },
  {
    id: "accounts",
    label: "Accounts & reports",
    desc: "Payments, banking, the chart of accounts, currency, reports and tools.",
    groups: ["Accounting", "Reports", "Tools"],
    href: "/w/accounting",
    tone: { ring: "border-sky-300 hover:border-sky-500", icon: "from-sky-500 to-sky-700", button: "bg-sky-600 hover:bg-sky-700", soft: "bg-sky-50 text-sky-700" },
  },
  {
    id: "hr",
    label: "Staff & shifts",
    desc: "Employees, the weekly roster, attendance, leave, advances and the monthly payroll.",
    groups: ["HR"],
    href: "/hr/attendance",
    tone: { ring: "border-emerald-300 hover:border-emerald-500", icon: "from-emerald-500 to-emerald-700", button: "bg-emerald-600 hover:bg-emerald-700", soft: "bg-emerald-50 text-emerald-700" },
  },
  {
    id: "coldchain",
    label: "Cold chain & calibration",
    desc: "Morning and evening temperatures of every fridge and store, and the calibration of the company's own instruments.",
    groups: ["Cold chain"],
    href: "/cold-chain/temperatures",
    tone: { ring: "border-cyan-300 hover:border-cyan-500", icon: "from-cyan-500 to-cyan-700", button: "bg-cyan-600 hover:bg-cyan-700", soft: "bg-cyan-50 text-cyan-700" },
  },
];

export const STATION_IDS = STATIONS.map((s) => s.id);

/** A new code opens every station; the owner narrows it per subscriber. */
export const DEFAULT_STATIONS = [...STATION_IDS];

export const cleanStations = (v: unknown): string[] =>
  Array.isArray(v) ? STATION_IDS.filter((id) => v.includes(id)) : [...DEFAULT_STATIONS];

export const stationLabel = (id: string) => STATIONS.find((s) => s.id === id)?.label ?? id;

/** The sidebar groups a set of stations leaves closed. */
export function closedGroups(open: string[]): Set<string> {
  const out = new Set<string>();
  for (const s of STATIONS) if (!open.includes(s.id)) for (const g of s.groups) out.add(g);
  return out;
}
