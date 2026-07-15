# ERPNext reference — removed

This project (**Spir-Margin**) was reverse-engineered from **ERPNext**. A full
snapshot of ERPNext used to live in this folder as a *source to port from*. That
snapshot has been **removed** now that every domain-relevant DocType has been
re-implemented natively (Next.js + embedded/hosted Postgres). Removing it dropped
**~4,200 files / 128 MB** from the repo.

The complete, authoritative ERPNext source remains public — this was only a
disposable copy, never the sole reference:

- **Upstream:** https://github.com/frappe/erpnext
- **Frappe framework:** https://github.com/frappe/frappe

## Why the snapshot was not kept

Most of ERPNext does not translate to this stack and is out of scope for a
lightweight medical-device / lab app:

- **Frappe-framework code** — `.py` controllers and `.js` desk scripts run on the
  Frappe server/desk runtime; reports, print formats, patches, workspaces, tests
  and `www/` are Frappe-specific artifacts. None map to React/Server Actions/SQL.
- **ERP-heavy modules** — deep accounting (GL entry, POS, budgets, dunning,
  period closing, payment reconciliation, subscriptions), asset depreciation,
  shop-floor manufacturing (job card, routing, workstation, production plan),
  SLA machinery, marketing campaigns, supplier scorecards, item variants,
  landed cost, stock-ledger internals, subcontracting.

## What was ported (DocType → where it lives now)

| ERPNext DocType(s) | Migration | Pages |
| --- | --- | --- |
| Item, Brand, Item Group, UOM | 0001 | `/products` |
| Asset, Batch, Serial No, Warehouse, Warehouse Type | 0001–0002, 0015, 0031 | `/devices`, `/kits`, `/serials`, `/warehouses` |
| Customer → Lab, Company/Supplier | 0001 | `/labs`, `/companies` |
| Stock movement / sale, profit & lab-status views | 0003–0004 | dashboard |
| Bank Account, Bank Transaction, Payment Entry (Banking app) | 0007–0009 | `/banking` |
| Purchase Invoice, Payment Term | 0010 | `/purchases`, `/payment-terms` |
| Item Price, Price List | 0011–0014 | `/prices` |
| Sales Order, Quotation, Delivery Note, Material Request | 0017, 0022, 0027, 0029 | `/sales-orders`, `/quotations`, `/delivery-notes`, `/material-requests` |
| Account, Journal Entry, Cost Center, Currency Exchange | 0018–0026 | `/accounts`, `/journal-entries`, `/cost-centers`, `/currency` |
| Lead, Opportunity | 0020–0021 | `/leads`, `/opportunities` |
| Supplier Quotation, Sales Person/Partner, Tax Category & Templates | 0030–0032 | `/supplier-quotations`, `/sales-team`, `/taxes` |
| BOM + Work Order | 0033 | `/boms`, `/work-orders` |
| Maintenance Visit + Schedule | 0034, 0043 | `/maintenance-visits`, `/maintenance-schedules` |
| Stock Entry, Quality Inspection | 0035–0036 | `/stock-entries`, `/quality-inspections` |
| Asset Movement, Asset Repair | 0037–0038 | `/asset-movements`, `/asset-repairs` |
| Sales Invoice (+ payment ledger) | 0039, 0044 | `/sales-invoices`, `/sales-invoices/[id]` |
| Purchase Order, Product Bundle, Installation Note | 0040–0042 | `/purchase-orders`, `/product-bundles`, `/installation-notes` |
| Issue (+ Type, Priority) | 0045 | `/issues` |
| Contract / AMC (+ Template) | 0046 | `/contracts` |
| Request for Quotation (+ item, supplier) | 0047 | `/rfqs` |
| Appointment | 0048 | `/appointments` |
| Asset Maintenance Team + Task | 0049 | `/maintenance-teams` |
| Customer Credit Limit | 0050 | `/credit-limits` |
| Pricing Rule | 0051 | `/pricing-rules` |
| Terms & Conditions, Sales Stage, Opportunity Type / Lost Reason | 0052 | `/masters` |

All schema + business logic lives in `supabase/migrations/`; the UI in `src/app/`.
