# Spir-Margin ↔ ERPNext — parity audit

**What this answers:** how closely Spir-Margin mirrors [ERPNext](https://github.com/frappe/erpnext)
in **features** and **look/design**, and exactly what was carried over vs. deliberately left out.

**Honest summary.** ERPNext is a full ERP: **~390 DocTypes** plus the **Frappe framework** (server
controllers in Python, the Desk UI in JS, reports, print formats, workspaces, patches, tests).
Spir-Margin is a **lightweight, domain-focused** re-implementation for medical-device sales, lab
tracking, spare parts and reagent kits. It re-implements the **domain-relevant subset natively**
(Next.js + Postgres) — **~62 DocTypes across 105 tables, 57 migrations, 117 routes** — and wraps it in
an **ERPNext-style "Desk" UI**. It is *not* a 1:1 clone of all of ERPNext, by design. The full ERPNext
source stays public upstream for anything not carried over.

Snapshot: 57 migrations · 105 tables · 117 routes · verified running on embedded Postgres (PGlite).

---

## Design / look parity (Frappe Desk elements reproduced)

| ERPNext Desk element | Spir-Margin |
| --- | --- |
| Espresso design tokens (ink-gray / surface / InterVariable) | ✅ used throughout (`src/app/globals.css`) |
| Grouped **workspace sidebar** (modules, collapsible) | ✅ `src/components/AppNav.tsx` + `src/lib/nav.ts` |
| **Workspace landing pages** (number cards + shortcuts) | ✅ `src/app/w/[slug]/page.tsx` |
| **Awesomebar** (⌘K global search / new-doc) | ✅ `src/components/desk/Awesomebar.tsx` |
| **List view** (breadcrumb, count, +Add, filter bar) | ✅ `src/components/desk/ListShell.tsx` (primary lists) |
| **Status indicators** (colored dot + label) | ✅ `src/components/desk/Indicator.tsx` |
| **Form view** (breadcrumb, status pill, meta sidebar) | ✅ `src/components/desk/FormShell.tsx` |
| Report view / print formats / desk customization | ➖ not reproduced (Frappe-framework features) |

*List chrome is applied to the primary transactional lists (labs, devices, kits, products, contracts,
appointments, issues, sales-orders, quotations, sales-invoices, purchase-orders, purchase-receipts,
payment-requests, blanket-orders, stock-balance, pick-lists, delivery-trips, opportunities,
work-orders); the remaining lists share the same Espresso card styling.*

---

## Feature parity (module by module)

Legend: ✅ ported · ➖ intentionally excluded (out of scope for a lightweight app) · ⛔ Frappe-framework (not portable to Next.js/SQL)

### CRM
| ERPNext DocType | Status | Where |
| --- | --- | --- |
| Lead | ✅ | 0020 · `/leads` |
| Opportunity (+ item) | ✅ | 0021 · `/opportunities` |
| Contract (+ Template) | ✅ | 0046 · `/contracts` |
| Appointment | ✅ | 0048 · `/appointments` |
| Campaign, Email Campaign, Prospect, Competitor | ➖ | marketing automation, out of scope |

### Selling
| Customer → **Lab** | ✅ | 0001 · `/labs` |
| Quotation (+ item) | ✅ | 0022 · `/quotations` |
| Sales Order (+ item) | ✅ | 0017 · `/sales-orders` |
| Sales Invoice (+ item, + payment ledger) | ✅ | 0039, 0044 · `/sales-invoices` (+ `[id]`) |
| Customer Credit Limit | ✅ | 0050 · `/credit-limits` |
| Pricing Rule | ✅ | 0051 · `/pricing-rules` |
| Product Bundle | ✅ | 0041 · `/product-bundles` |
| Installation Note | ✅ | 0042 · `/installation-notes` |
| Sales Person / Partner | ✅ | 0031 · `/sales-team` |
| Blanket Order (+ item, draw-down) | ✅ | 0056 · `/blanket-orders` |
| SMS Center, Party Specific Item | ➖ | secondary, out of scope |

### Buying
| Supplier → **Company** | ✅ | 0001 · `/companies` |
| Purchase Order (+ item) | ✅ | 0040 · `/purchase-orders` (+ `[id]`) |
| Purchase Invoice (+ item) | ✅ | 0010 · `/purchases` |
| Purchase Receipt (+ item, receive to stock) | ✅ | 0054 · `/purchase-receipts` |
| Supplier Quotation (+ item) | ✅ | 0030 · `/supplier-quotations` |
| Request for Quotation (+ item, + supplier) | ✅ | 0047 · `/rfqs` (+ `[id]`) |
| Payment Term | ✅ | 0010 · `/payment-terms` |
| Supplier Scorecard, RFQ portal | ➖ | scorecard/portal out of scope |

### Stock
| Item → **Product** (+ Brand, Item Group, UOM) | ✅ | 0001 · `/products` |
| Batch → **Kit Batch** | ✅ | 0002 · `/kits` |
| Serial No | ✅ | 0015 · `/serials` |
| Warehouse (+ Warehouse Type) | ✅ | 0001, 0031 · `/warehouses` |
| Stock Entry (+ detail) | ✅ | 0035 · `/stock-entries` |
| Delivery Note (+ item) | ✅ | 0027 · `/delivery-notes` |
| Material Request (+ item) | ✅ | 0029 · `/material-requests` |
| Stock Reconciliation (+ item) | ✅ | 0016 · `/stock-reconciliation` |
| Quality Inspection (+ reading) | ✅ | 0036 · `/quality-inspections` |
| Item Price / Price List | ✅ | 0011-0014 · `/prices` |
| Stock Balance (report: qty + valuation per product/warehouse) | ✅ | 0053 · `/stock-balance` |
| Pick List (+ item, picked_qty) | ✅ | 0057 · `/pick-lists` |
| Delivery Trip (+ stops) | ✅ | 0058 · `/delivery-trips` |
| Item Variant/Attribute, Landed Cost, Shipment, Bin/Stock Ledger, Packing Slip | ➖ | ERP-heavy stock internals, out of scope |

### Manufacturing
| BOM (+ item) | ✅ | 0033 · `/boms` |
| Work Order | ✅ | 0033 · `/work-orders` |
| Job Card, Routing, Workstation, Operation, Production Plan | ➖ | shop-floor detail, out of scope |

### Assets
| Asset → **Device** | ✅ | 0002 · `/devices` |
| Asset Movement (+ item) | ✅ | 0037 · `/asset-movements` |
| Asset Repair | ✅ | 0038 · `/asset-repairs` |
| Asset Maintenance (log) | ✅ | 0002 (maintenance_logs) |
| Asset Maintenance Team + Task | ✅ | 0049 · `/maintenance-teams` |
| Asset Depreciation / Capitalization / Value Adjustment | ➖ | accounting-heavy, out of scope |

### Maintenance
| Maintenance Visit (+ purpose) | ✅ | 0034 · `/maintenance-visits` |
| Maintenance Schedule (+ detail) | ✅ | 0043 · `/maintenance-schedules` |

### Support
| Issue (+ Type, Priority) | ✅ | 0045 · `/issues` (+ `[id]`) |
| Warranty Claim | ✅ | 0019 · `/warranty` |
| Service Level Agreement (SLA) | ➖ | SLA machinery, out of scope |

### Accounting
| Account (Chart of Accounts) | ✅ | 0018 · `/accounts` |
| Journal Entry (+ account) | ✅ | 0023 · `/journal-entries` |
| Cost Center | ✅ | 0024 · `/cost-centers` |
| Payment Entry | ✅ | 0007-0009 (banking) |
| Payment Request (against a Sales Invoice) | ✅ | 0055 · `/payment-requests` |
| Auto Repeat / recurring AMC billing (subset of Subscription) | ✅ | 0064 · `/amc-billing` — contract billing interval + one-click draft-invoice generation |
| Bank Account / Bank Transaction / Reconciliation (Banking app) | ✅ | 0007-0009 · `/banking` |
| Currency Exchange | ✅ | 0025-0026 · `/currency` |
| Tax Category / Taxes & Charges Template | ✅ | 0032 · `/taxes` |
| Mode of Payment | ✅ | 0010 |
| GL Entry, POS, Budget, Dunning, Period Closing, Payment Reconciliation (175 doctypes) | ➖ | deep double-entry ERP, out of scope |

### Setup / Masters
| Territory, Customer Group, Supplier Group, Asset Category | ✅ | 0011-0013 |
| Terms & Conditions, Sales Stage, Opportunity Type / Lost Reason | ✅ | 0052 · `/masters` |
| Company, Fiscal Year, Print/Email settings, Item settings | ➖ | single-tenant app; framework settings not needed |

### Not portable (Frappe framework)
Server controllers (`*.py`), Desk client scripts (`*.js`), Query/Script **Reports**, **Print Formats**,
**Workspaces** (as data), **Patches**, **Tests**, portal/`www` pages, DocType metadata engine — ⛔ these
run on the Frappe runtime and have no equivalent in a Next.js + SQL stack. Their *behaviour* was
re-expressed as Postgres functions/triggers and React pages where relevant.

---

## Bottom line
- **Domain features:** the medical-device / lab / kit / spare-part / reagent workflow is covered
  end-to-end — procure (PO / RFQ / blanket order) → **receive (Purchase Receipt → stock)** → QC →
  install/move → maintain → sell → **pick (Pick List) → deliver (Delivery Note / Delivery Trip route)** →
  invoice → **collect (Payment Request → invoice ledger)** — plus CRM, a Stock Balance report, banking
  reconciliation and light accounting.
- **Look & design:** an ERPNext-style Desk (workspaces, awesomebar, list/form shells, status
  indicators) on Frappe's own Espresso tokens.
- **Not carried over (by design):** the ERP-heavy modules (deep accounting, depreciation, shop-floor
  manufacturing, SLA, campaigns, item variants, landed cost, POS, subscriptions) and all
  Frappe-framework machinery. These remain available upstream at
  https://github.com/frappe/erpnext and https://github.com/frappe/frappe.
