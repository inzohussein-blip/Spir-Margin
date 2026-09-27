/**
 * The web app's pages, as data. Each entry is one list of the installed
 * program — its table, what the list shows, the form that makes and edits a
 * record, the lines of a document, and the buttons a record offers (the same
 * database functions the installed version calls). The generic screens in
 * src/components/local/entity.tsx turn an entry into its list, form and
 * record pages, on the database in the browser.
 *
 * Labels are the English keys of src/lib/i18n.ts; stored choice values are
 * shown with tValue(). Self-contained: no imports, so tests can read it as is.
 */

export type FieldType =
  | "text" | "number" | "date" | "datetime" | "time" | "textarea"
  | "select" | "ref" | "check" | "email" | "tel";

export interface Ref {
  table: string;
  /** The column people recognise the row by. */
  label: string;
  /** A second column shown beside it (a code). */
  code?: string;
  /** Only rows where these columns equal these values. */
  where?: Record<string, string | boolean>;
  /** Columns copied into sibling fields when a row is picked: { field: column }. */
  fill?: Record<string, string>;
  /** The column stored in the field (default "id"). */
  value?: string;
}

export interface Field {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  /** Stored values of a choice (shown with tValue). */
  options?: string[];
  ref?: Ref;
  /** "today", "now", "month" (YYYY-MM), or a value. */
  default?: string | number | boolean;
  ltr?: boolean;
  /** Takes the form's full width. */
  wide?: boolean;
  /** Left blank, the number is minted by fn_next_doc_no(kind). */
  docKind?: string;
  /** Shown only when making a record (not when editing). */
  createOnly?: boolean;
}

export type ColumnKind = "money" | "num" | "date" | "datetime" | "status" | "value" | "ltr" | "bool";

export interface Column {
  /** A column, or "table.column" through a reference (select must embed it). */
  key: string;
  label: string;
  kind?: ColumnKind;
}

export interface Action {
  id: string;
  label: string;
  /** A database function called with the record's id as `arg`. */
  rpc?: string;
  arg?: string;
  /** Further arguments of the function. */
  args?: Record<string, unknown>;
  /** An argument that is a new document's number, minted by fn_next_doc_no(kind). */
  numbered?: { name: string; kind: string };
  /** Or a change written to the record. */
  update?: Record<string, unknown>;
  /** Offered only while the record's status is one of these. */
  when?: string[];
  /** Asks before running. */
  confirm?: string;
  /** One value asked for (a payment amount), passed as `name`; `from` fills it from the record. */
  input?: { name: string; label: string; from?: string };
  tone?: "primary" | "danger";
  /** The function returns a new record of this entity: open it. */
  opens?: string;
}

export interface Lines {
  table: string;
  /** The column pointing at the document. */
  fk: string;
  /** What the record page reads (embedding refs for labels). */
  select: string;
  fields: Field[];
  columns: Column[];
}

export interface Entity {
  /** Route: #/e/<id>. */
  id: string;
  table: string;
  station: string;
  /** Plural, as in the menu. */
  label: string;
  /** "New …" button and form title. */
  single: string;
  icon: string;
  select: string;
  columns: Column[];
  search: string[];
  order: [string, boolean];
  /** The column that names a record on its page. */
  title: string;
  fields: Field[];
  lines?: Lines;
  actions?: Action[];
  /** Statuses in which the record can be edited (none = always; [] = never). */
  editable?: string[];
  /** Statuses in which it can be deleted (none = never). */
  deletable?: string[];
  /** A view: list only. */
  readonly?: boolean;
  /** A view whose rows open another entity's record. */
  opens?: string;
  /** Only rows matching these conditions. */
  where?: [string, "eq" | "neq" | "gt" | "in", unknown][];
  /** Extra read-only columns shown on the record page. */
  detail?: Column[];
}

// ---------------------------------------------------------------- shared bits
const LAB: Ref = { table: "labs", label: "name", code: "code" };
const SUPPLIER: Ref = { table: "companies", label: "name", where: { is_disabled: false } };
const PRODUCT_SELL: Ref = { table: "products", label: "name", code: "item_code", where: { is_disabled: false }, fill: { rate: "default_sell_price" } };
const PRODUCT_BUY: Ref = { table: "products", label: "name", code: "item_code", where: { is_disabled: false }, fill: { rate: "default_buy_price" } };
const PRODUCT: Ref = { table: "products", label: "name", code: "item_code", where: { is_disabled: false } };
const WAREHOUSE: Ref = { table: "warehouses", label: "name", where: { is_disabled: false } };
const DEVICE: Ref = { table: "devices", label: "asset_code", code: "serial_no" };
const EMPLOYEE: Ref = { table: "hr_employees", label: "full_name", code: "code", where: { is_active: true } };
const BATCH: Ref = { table: "kit_batches", label: "batch_no", fill: { rate: "buy_price" } };
const CURRENCIES = ["USD", "IQD"];

const saleLines = (table: string, fk: string): Lines => ({
  table, fk,
  select: `id, qty, rate, amount, product_id, products(name, item_code)`,
  fields: [
    { name: "product_id", label: "Product", type: "ref", ref: PRODUCT_SELL, required: true },
    { name: "qty", label: "Qty", type: "number", required: true, default: 1 },
    { name: "rate", label: "Rate", type: "number", default: 0 },
  ],
  columns: [
    { key: "products.name", label: "Product" },
    { key: "qty", label: "Qty", kind: "num" },
    { key: "rate", label: "Rate", kind: "money" },
    { key: "amount", label: "Amount", kind: "money" },
  ],
});

// ---------------------------------------------------------------- the pages
export const ENTITIES: Entity[] = [
  // ── Sales & customers ────────────────────────────────────────────────
  {
    id: "labs", table: "labs", station: "sales", label: "Labs", single: "New lab", icon: "flask",
    select: "id, code, name, city, phone, status, contact_name",
    columns: [
      { key: "code", label: "Code", kind: "ltr" }, { key: "name", label: "Name" }, { key: "city", label: "City" },
      { key: "phone", label: "Phone", kind: "ltr" }, { key: "status", label: "Status", kind: "status" },
    ],
    search: ["code", "name", "city", "phone", "contact_name"], order: ["name", true], title: "name",
    fields: [
      { name: "code", label: "Code", required: true, ltr: true, createOnly: true },
      { name: "name", label: "Name", required: true },
      { name: "status", label: "Status", type: "select", options: ["active", "inactive"], default: "active" },
      { name: "city", label: "City" },
      { name: "address", label: "Address" },
      { name: "contact_name", label: "Contact" },
      { name: "phone", label: "Phone", type: "tel", ltr: true },
      { name: "email", label: "Email", type: "email", ltr: true },
      { name: "territory", label: "Territory" },
      { name: "customer_group", label: "Customer group" },
    ],
    deletable: ["active", "inactive"],
  },
  {
    id: "leads", table: "leads", station: "sales", label: "Leads", single: "New lead", icon: "userplus",
    select: "id, lead_name, company_name, phone, city, status",
    columns: [
      { key: "lead_name", label: "Name" }, { key: "company_name", label: "Company" }, { key: "phone", label: "Phone", kind: "ltr" },
      { key: "city", label: "City" }, { key: "status", label: "Status", kind: "status" },
    ],
    search: ["lead_name", "company_name", "phone", "city"], order: ["created_at", false], title: "lead_name",
    fields: [
      { name: "lead_name", label: "Name", required: true },
      { name: "company_name", label: "Company" },
      { name: "status", label: "Status", type: "select", options: ["lead", "open", "replied", "opportunity", "quotation", "interested", "converted", "do_not_contact"], default: "lead" },
      { name: "phone", label: "Phone", type: "tel", ltr: true },
      { name: "email", label: "Email", type: "email", ltr: true },
      { name: "city", label: "City" },
      { name: "source", label: "Source" },
      { name: "notes", label: "Notes", type: "textarea", wide: true },
    ],
    deletable: ["lead", "open", "replied", "do_not_contact"],
  },
  {
    id: "appointments", table: "appointments", station: "sales", label: "Appointments", single: "New appointment", icon: "calendar",
    select: "id, appointment_no, scheduled_time, purpose, status, labs(name)",
    columns: [
      { key: "appointment_no", label: "No.", kind: "ltr" }, { key: "scheduled_time", label: "Time", kind: "datetime" },
      { key: "labs.name", label: "Lab" }, { key: "purpose", label: "Purpose", kind: "value" }, { key: "status", label: "Status", kind: "status" },
    ],
    search: ["appointment_no", "contact_name", "notes"], order: ["scheduled_time", false], title: "appointment_no",
    fields: [
      { name: "appointment_no", label: "No.", docKind: "apt", ltr: true, createOnly: true },
      { name: "lab_id", label: "Lab", type: "ref", ref: LAB },
      { name: "scheduled_time", label: "Time", type: "datetime", required: true, default: "now" },
      { name: "purpose", label: "Purpose", type: "select", options: ["installation", "service", "training", "other"], default: "service" },
      { name: "status", label: "Status", type: "select", options: ["open", "confirmed", "completed", "cancelled"], default: "open" },
      { name: "contact_name", label: "Contact" },
      { name: "contact_phone", label: "Phone", type: "tel", ltr: true },
      { name: "notes", label: "Notes", type: "textarea", wide: true },
    ],
    deletable: ["open", "cancelled"],
  },
  {
    id: "quotations", table: "quotations", station: "sales", label: "Quotations", single: "New quotation", icon: "file",
    select: "id, naming_series, transaction_date, valid_till, status, total_amount, currency, labs(name)",
    columns: [
      { key: "naming_series", label: "No.", kind: "ltr" }, { key: "transaction_date", label: "Date", kind: "date" },
      { key: "labs.name", label: "Lab" }, { key: "total_amount", label: "Total", kind: "money" }, { key: "status", label: "Status", kind: "status" },
    ],
    search: ["naming_series", "notes"], order: ["transaction_date", false], title: "naming_series",
    fields: [
      { name: "naming_series", label: "No.", docKind: "qt", ltr: true, createOnly: true },
      { name: "lab_id", label: "Lab", type: "ref", ref: LAB, required: true },
      { name: "transaction_date", label: "Date", type: "date", default: "today" },
      { name: "valid_till", label: "Valid till", type: "date" },
      { name: "currency", label: "Currency", type: "select", options: CURRENCIES, default: "USD" },
      { name: "notes", label: "Notes", type: "textarea", wide: true },
    ],
    lines: saleLines("quotation_items", "quotation_id"),
    actions: [
      { id: "submit", label: "Submit", update: { status: "submitted" }, when: ["draft"], tone: "primary" },
      { id: "order", label: "Make sales order", rpc: "fn_quotation_to_sales_order", arg: "p_quote_id", when: ["submitted"], opens: "sales-orders", tone: "primary" },
      { id: "lost", label: "Mark lost", update: { status: "lost" }, when: ["draft", "submitted"], confirm: "Mark this quotation lost?" },
    ],
    editable: ["draft"], deletable: ["draft"],
  },
  {
    id: "sales-orders", table: "sales_orders", station: "sales", label: "Sales Orders", single: "New sales order", icon: "clipboard",
    select: "id, naming_series, transaction_date, delivery_date, status, total_amount, labs(name)",
    columns: [
      { key: "naming_series", label: "No.", kind: "ltr" }, { key: "transaction_date", label: "Date", kind: "date" },
      { key: "labs.name", label: "Lab" }, { key: "total_amount", label: "Total", kind: "money" }, { key: "status", label: "Status", kind: "status" },
    ],
    search: ["naming_series", "notes"], order: ["transaction_date", false], title: "naming_series",
    fields: [
      { name: "naming_series", label: "No.", docKind: "so", ltr: true, createOnly: true },
      { name: "lab_id", label: "Lab", type: "ref", ref: LAB, required: true },
      { name: "transaction_date", label: "Date", type: "date", default: "today" },
      { name: "delivery_date", label: "Delivery date", type: "date" },
      { name: "notes", label: "Notes", type: "textarea", wide: true },
    ],
    lines: saleLines("sales_order_items", "sales_order_id"),
    actions: [
      { id: "confirm", label: "Confirm", update: { status: "confirmed" }, when: ["draft"], tone: "primary" },
      { id: "deliver", label: "Deliver", rpc: "fn_deliver_sales_order", arg: "p_so_id", when: ["draft", "confirmed"], confirm: "Deliver this order? Its stock is taken and the sales are booked.", tone: "primary" },
      { id: "invoice", label: "Make invoice", rpc: "fn_invoice_from_sales_order", arg: "p_so_id", numbered: { name: "p_invoice_no", kind: "si" }, when: ["confirmed", "delivered"], opens: "sales-invoices" },
      { id: "cancel", label: "Cancel", update: { status: "cancelled" }, when: ["draft", "confirmed"], confirm: "Cancel this order?", tone: "danger" },
    ],
    editable: ["draft"], deletable: ["draft", "cancelled"],
  },
  {
    id: "sales-invoices", table: "sales_invoices", station: "sales", label: "Sales Invoices", single: "New invoice", icon: "receipt",
    select: "id, invoice_no, posting_date, due_date, status, total_amount, outstanding, currency, labs(name)",
    columns: [
      { key: "invoice_no", label: "Invoice", kind: "ltr" }, { key: "posting_date", label: "Date", kind: "date" },
      { key: "labs.name", label: "Lab" }, { key: "total_amount", label: "Total", kind: "money" },
      { key: "outstanding", label: "Outstanding", kind: "money" }, { key: "status", label: "Status", kind: "status" },
    ],
    search: ["invoice_no", "notes"], order: ["posting_date", false], title: "invoice_no",
    fields: [
      { name: "invoice_no", label: "Invoice no.", docKind: "si", ltr: true, createOnly: true },
      { name: "lab_id", label: "Lab", type: "ref", ref: LAB, required: true },
      { name: "posting_date", label: "Date", type: "date", default: "today" },
      { name: "due_date", label: "Due date", type: "date" },
      { name: "currency", label: "Currency", type: "select", options: CURRENCIES, default: "USD" },
      { name: "notes", label: "Notes", type: "textarea", wide: true },
    ],
    lines: saleLines("sales_invoice_items", "invoice_id"),
    actions: [
      { id: "submit", label: "Submit", rpc: "fn_submit_sales_invoice", arg: "p_invoice_id", when: ["draft"], confirm: "Submit this invoice? It can no longer be edited.", tone: "primary" },
      { id: "pay", label: "Record payment", rpc: "fn_record_invoice_payment", arg: "p_invoice_id", when: ["unpaid", "partly_paid"], input: { name: "p_amount", label: "Amount", from: "outstanding" }, tone: "primary" },
      { id: "cancel", label: "Cancel", update: { status: "cancelled" }, when: ["draft", "unpaid"], confirm: "Cancel this invoice?", tone: "danger" },
    ],
    editable: ["draft"], deletable: ["draft"],
  },
  {
    id: "contracts", table: "contracts", station: "sales", label: "Contracts", single: "New contract", icon: "signature",
    select: "id, contract_no, start_date, end_date, contract_value, status, labs(name)",
    columns: [
      { key: "contract_no", label: "No.", kind: "ltr" }, { key: "labs.name", label: "Lab" }, { key: "start_date", label: "Start", kind: "date" },
      { key: "end_date", label: "End", kind: "date" }, { key: "contract_value", label: "Value", kind: "money" }, { key: "status", label: "Status", kind: "status" },
    ],
    search: ["contract_no", "signee", "contract_terms"], order: ["created_at", false], title: "contract_no",
    fields: [
      { name: "contract_no", label: "No.", docKind: "ct", ltr: true, createOnly: true },
      { name: "lab_id", label: "Lab", type: "ref", ref: LAB },
      { name: "device_id", label: "Device", type: "ref", ref: DEVICE },
      { name: "status", label: "Status", type: "select", options: ["unsigned", "active", "inactive", "cancelled"], default: "unsigned" },
      { name: "start_date", label: "Start", type: "date" },
      { name: "end_date", label: "End", type: "date" },
      { name: "contract_value", label: "Value", type: "number", default: 0 },
      { name: "billing_interval", label: "Billing", type: "select", options: ["none", "monthly", "quarterly", "annually"], default: "none" },
      { name: "signee", label: "Signee" },
      { name: "contract_terms", label: "Terms", type: "textarea", wide: true },
    ],
    deletable: ["unsigned", "cancelled"],
  },

  // ── Purchasing & stock ───────────────────────────────────────────────
  {
    id: "suppliers", table: "companies", station: "supply", label: "Suppliers", single: "New Company", icon: "building",
    select: "id, name, role, country, phone, email",
    columns: [
      { key: "name", label: "Name" }, { key: "role", label: "Role", kind: "value" }, { key: "country", label: "Country" },
      { key: "phone", label: "Phone", kind: "ltr" }, { key: "email", label: "Email", kind: "ltr" },
    ],
    search: ["name", "country", "phone", "email", "tax_id"], order: ["name", true], title: "name",
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "role", label: "Role", type: "select", options: ["supplier", "parent", "customer"], default: "supplier" },
      { name: "supplier_type", label: "Supplier type", type: "select", options: ["company", "individual", "partnership"], default: "company" },
      { name: "supplier_group", label: "Supplier group" },
      { name: "tax_id", label: "Tax ID", ltr: true },
      { name: "country", label: "Country" },
      { name: "phone", label: "Phone", type: "tel", ltr: true },
      { name: "email", label: "Email", type: "email", ltr: true },
      { name: "is_disabled", label: "Disabled", type: "check" },
    ],
  },
  {
    id: "products", table: "products", station: "supply", label: "Products", single: "New product", icon: "package",
    select: "id, item_code, name, product_type, default_buy_price, default_sell_price, is_disabled",
    columns: [
      { key: "item_code", label: "Code", kind: "ltr" }, { key: "name", label: "Name" }, { key: "product_type", label: "Type", kind: "value" },
      { key: "default_buy_price", label: "Buy price", kind: "money" }, { key: "default_sell_price", label: "Sell price", kind: "money" },
    ],
    search: ["item_code", "name", "brand", "item_group"], order: ["name", true], title: "name",
    fields: [
      { name: "item_code", label: "Code", required: true, ltr: true },
      { name: "name", label: "Name", required: true },
      { name: "product_type", label: "Type", type: "select", options: ["kit", "device", "spare_part"], required: true, default: "kit" },
      { name: "brand", label: "Brand" },
      { name: "item_group", label: "Item group" },
      { name: "uom", label: "Unit", default: "Nos" },
      { name: "supplier_id", label: "Supplier", type: "ref", ref: SUPPLIER },
      { name: "default_buy_price", label: "Buy price", type: "number", default: 0 },
      { name: "default_sell_price", label: "Sell price", type: "number", default: 0 },
      { name: "reorder_level", label: "Reorder level", type: "number", default: 0 },
      { name: "shelf_life_in_days", label: "Shelf life (days)", type: "number" },
      { name: "is_disabled", label: "Disabled", type: "check" },
      { name: "description", label: "Description", type: "textarea", wide: true },
    ],
  },
  {
    id: "warehouses", table: "warehouses", station: "supply", label: "Warehouses", single: "New warehouse", icon: "warehouse",
    select: "id, name, warehouse_type, city, phone, is_disabled",
    columns: [{ key: "name", label: "Name" }, { key: "warehouse_type", label: "Type" }, { key: "city", label: "City" }, { key: "phone", label: "Phone", kind: "ltr" }],
    search: ["name", "city"], order: ["name", true], title: "name",
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "warehouse_type", label: "Type" },
      { name: "city", label: "City" },
      { name: "address", label: "Address" },
      { name: "phone", label: "Phone", type: "tel", ltr: true },
      { name: "is_disabled", label: "Disabled", type: "check" },
    ],
  },
  {
    id: "kit-batches", table: "kit_batches", station: "supply", label: "Kits", single: "New batch", icon: "boxes",
    select: "id, batch_no, expiry_date, qty_available, qty_received, buy_price, products(name), warehouses(name)",
    columns: [
      { key: "batch_no", label: "Batch", kind: "ltr" }, { key: "products.name", label: "Product" }, { key: "warehouses.name", label: "Warehouse" },
      { key: "expiry_date", label: "Expiry", kind: "date" }, { key: "qty_available", label: "Available", kind: "num" },
    ],
    search: ["batch_no"], order: ["expiry_date", true], title: "batch_no",
    fields: [
      { name: "batch_no", label: "Batch", required: true, ltr: true },
      { name: "product_id", label: "Product", type: "ref", ref: PRODUCT, required: true },
      { name: "warehouse_id", label: "Warehouse", type: "ref", ref: WAREHOUSE },
      { name: "supplier_id", label: "Supplier", type: "ref", ref: SUPPLIER },
      { name: "manufacturing_date", label: "Manufactured", type: "date" },
      { name: "expiry_date", label: "Expiry", type: "date" },
      { name: "qty_received", label: "Received", type: "number", default: 0, createOnly: true },
      { name: "qty_available", label: "Available", type: "number", default: 0 },
      { name: "buy_price", label: "Buy price", type: "number", default: 0 },
      { name: "sell_price", label: "Sell price", type: "number", default: 0 },
    ],
  },
  {
    id: "stock-balance", table: "v_stock_balance", station: "supply", label: "Stock Balance", single: "", icon: "list",
    select: "product_id, item_code, product_name, product_type, warehouse_name, qty, stock_value, batches",
    columns: [
      { key: "item_code", label: "Code", kind: "ltr" }, { key: "product_name", label: "Product" }, { key: "warehouse_name", label: "Warehouse" },
      { key: "qty", label: "Qty", kind: "num" }, { key: "stock_value", label: "Value", kind: "money" },
    ],
    search: ["item_code", "product_name", "warehouse_name"], order: ["product_name", true], title: "product_name",
    fields: [], readonly: true,
  },
  {
    id: "purchase-orders", table: "purchase_orders", station: "supply", label: "Purchase Orders", single: "New purchase order", icon: "scroll",
    select: "id, po_no, transaction_date, required_by, status, total_amount, currency, companies(name)",
    columns: [
      { key: "po_no", label: "No.", kind: "ltr" }, { key: "transaction_date", label: "Date", kind: "date" },
      { key: "companies.name", label: "Supplier" }, { key: "total_amount", label: "Total", kind: "money" }, { key: "status", label: "Status", kind: "status" },
    ],
    search: ["po_no", "notes"], order: ["transaction_date", false], title: "po_no",
    fields: [
      { name: "po_no", label: "PO no.", docKind: "po", ltr: true, createOnly: true },
      { name: "supplier_id", label: "Supplier", type: "ref", ref: SUPPLIER, required: true },
      { name: "transaction_date", label: "Date", type: "date", default: "today" },
      { name: "required_by", label: "Required by", type: "date" },
      { name: "currency", label: "Currency", type: "select", options: CURRENCIES, default: "USD" },
      { name: "notes", label: "Notes", type: "textarea", wide: true },
    ],
    lines: {
      table: "purchase_order_items", fk: "po_id",
      select: "id, qty, rate, amount, product_id, products(name, item_code)",
      fields: [
        { name: "product_id", label: "Product", type: "ref", ref: PRODUCT_BUY, required: true },
        { name: "qty", label: "Qty", type: "number", required: true, default: 1 },
        { name: "rate", label: "Rate", type: "number", default: 0 },
      ],
      columns: [
        { key: "products.name", label: "Product" }, { key: "qty", label: "Qty", kind: "num" },
        { key: "rate", label: "Rate", kind: "money" }, { key: "amount", label: "Amount", kind: "money" },
      ],
    },
    actions: [
      { id: "submit", label: "Submit", rpc: "fn_submit_purchase_order", arg: "p_po_id", when: ["draft"], tone: "primary" },
      { id: "receive", label: "Make receipt", rpc: "fn_receipt_from_po", arg: "p_po_id", numbered: { name: "p_receipt_no", kind: "pr" }, when: ["submitted"], opens: "purchase-receipts", tone: "primary" },
      { id: "cancel", label: "Cancel", update: { status: "cancelled" }, when: ["draft", "submitted"], confirm: "Cancel this purchase order?", tone: "danger" },
    ],
    editable: ["draft"], deletable: ["draft"],
  },
  {
    id: "purchase-receipts", table: "purchase_receipts", station: "supply", label: "Purchase Receipts", single: "New receipt", icon: "packageplus",
    select: "id, receipt_no, posting_date, status, companies(name)",
    columns: [
      { key: "receipt_no", label: "No.", kind: "ltr" }, { key: "posting_date", label: "Date", kind: "date" },
      { key: "companies.name", label: "Supplier" }, { key: "status", label: "Status", kind: "status" },
    ],
    search: ["receipt_no", "notes"], order: ["posting_date", false], title: "receipt_no",
    fields: [
      { name: "receipt_no", label: "No.", docKind: "pr", ltr: true, createOnly: true },
      { name: "supplier_id", label: "Supplier", type: "ref", ref: SUPPLIER },
      { name: "posting_date", label: "Date", type: "date", default: "today" },
      { name: "notes", label: "Notes", type: "textarea", wide: true },
    ],
    lines: {
      table: "purchase_receipt_items", fk: "receipt_id",
      select: "id, qty, rate, batch_no, expiry_date, product_id, warehouse_id, products(name), warehouses(name)",
      fields: [
        { name: "product_id", label: "Product", type: "ref", ref: PRODUCT_BUY, required: true },
        { name: "qty", label: "Qty", type: "number", required: true, default: 1 },
        { name: "rate", label: "Rate", type: "number", default: 0 },
        { name: "warehouse_id", label: "Warehouse", type: "ref", ref: WAREHOUSE },
        { name: "batch_no", label: "Batch", ltr: true },
        { name: "expiry_date", label: "Expiry", type: "date" },
      ],
      columns: [
        { key: "products.name", label: "Product" }, { key: "qty", label: "Qty", kind: "num" }, { key: "rate", label: "Rate", kind: "money" },
        { key: "warehouses.name", label: "Warehouse" }, { key: "batch_no", label: "Batch", kind: "ltr" }, { key: "expiry_date", label: "Expiry", kind: "date" },
      ],
    },
    actions: [
      { id: "submit", label: "Receive", rpc: "fn_submit_purchase_receipt", arg: "p_receipt_id", when: ["draft"], confirm: "Receive these items into stock?", tone: "primary" },
      { id: "cancel", label: "Cancel", update: { status: "cancelled" }, when: ["draft"], tone: "danger" },
    ],
    editable: ["draft"], deletable: ["draft"],
  },
  {
    id: "stock-entries", table: "stock_entries", station: "supply", label: "Stock Entries", single: "New stock entry", icon: "arrows",
    select: "id, entry_no, purpose, posting_date, status, fw:from_warehouse(name), tw:to_warehouse(name)",
    columns: [
      { key: "entry_no", label: "No.", kind: "ltr" }, { key: "posting_date", label: "Date", kind: "date" }, { key: "purpose", label: "Purpose", kind: "value" },
      { key: "fw.name", label: "From" }, { key: "tw.name", label: "To" }, { key: "status", label: "Status", kind: "status" },
    ],
    search: ["entry_no", "notes"], order: ["posting_date", false], title: "entry_no",
    fields: [
      { name: "entry_no", label: "No.", docKind: "se", ltr: true, createOnly: true },
      { name: "purpose", label: "Purpose", type: "select", options: ["transfer", "receipt", "issue"], default: "transfer" },
      { name: "posting_date", label: "Date", type: "date", default: "today" },
      { name: "from_warehouse", label: "From", type: "ref", ref: WAREHOUSE },
      { name: "to_warehouse", label: "To", type: "ref", ref: WAREHOUSE },
      { name: "notes", label: "Notes", type: "textarea", wide: true },
    ],
    lines: {
      table: "stock_entry_items", fk: "entry_id",
      select: "id, qty, rate, batch_id, kit_batches(batch_no, products(name))",
      fields: [
        { name: "batch_id", label: "Batch", type: "ref", ref: BATCH, required: true },
        { name: "qty", label: "Qty", type: "number", required: true, default: 1 },
        { name: "rate", label: "Rate", type: "number", default: 0 },
      ],
      columns: [{ key: "kit_batches.batch_no", label: "Batch", kind: "ltr" }, { key: "qty", label: "Qty", kind: "num" }, { key: "rate", label: "Rate", kind: "money" }],
    },
    actions: [
      { id: "submit", label: "Submit", rpc: "fn_submit_stock_entry", arg: "p_entry_id", when: ["draft"], confirm: "Submit this entry? Stock moves now.", tone: "primary" },
      { id: "cancel", label: "Cancel", update: { status: "cancelled" }, when: ["draft"], tone: "danger" },
    ],
    editable: ["draft"], deletable: ["draft"],
  },

  // ── Devices & maintenance ────────────────────────────────────────────
  {
    id: "devices", table: "devices", station: "service", label: "Devices", single: "New device", icon: "monitor",
    select: "id, asset_code, serial_no, status, next_maintenance_date, products(name), labs(name)",
    columns: [
      { key: "asset_code", label: "Asset", kind: "ltr" }, { key: "products.name", label: "Product" }, { key: "serial_no", label: "Serial", kind: "ltr" },
      { key: "labs.name", label: "Lab" }, { key: "status", label: "Status", kind: "status" }, { key: "next_maintenance_date", label: "Next maintenance", kind: "date" },
    ],
    search: ["asset_code", "serial_no", "custodian_name"], order: ["asset_code", true], title: "asset_code",
    fields: [
      { name: "asset_code", label: "Asset code", required: true, ltr: true },
      { name: "product_id", label: "Product", type: "ref", ref: PRODUCT, required: true },
      { name: "serial_no", label: "Serial", ltr: true },
      { name: "status", label: "Status", type: "select", options: ["in_stock", "installed", "in_maintenance", "out_of_order", "retired"], default: "in_stock" },
      { name: "lab_id", label: "Lab", type: "ref", ref: LAB },
      { name: "warehouse_id", label: "Warehouse", type: "ref", ref: WAREHOUSE },
      { name: "custodian_name", label: "Custodian" },
      { name: "purchase_date", label: "Purchase date", type: "date" },
      { name: "purchase_price", label: "Purchase price", type: "number", default: 0 },
      { name: "maintenance_required", label: "Needs maintenance", type: "check" },
      { name: "next_maintenance_date", label: "Next maintenance", type: "date" },
    ],
  },
  {
    id: "installation-notes", table: "installation_notes", station: "service", label: "Installations", single: "New installation", icon: "plug",
    select: "id, inst_no, inst_date, status, labs(name)",
    columns: [
      { key: "inst_no", label: "No.", kind: "ltr" }, { key: "inst_date", label: "Date", kind: "date" },
      { key: "labs.name", label: "Lab" }, { key: "status", label: "Status", kind: "status" },
    ],
    search: ["inst_no", "remarks"], order: ["inst_date", false], title: "inst_no",
    fields: [
      { name: "inst_no", label: "No.", docKind: "in", ltr: true, createOnly: true },
      { name: "lab_id", label: "Lab", type: "ref", ref: LAB, required: true },
      { name: "inst_date", label: "Date", type: "date", default: "today" },
      { name: "inst_time", label: "Time", type: "time" },
      { name: "remarks", label: "Remarks", type: "textarea", wide: true },
    ],
    lines: {
      table: "installation_note_items", fk: "note_id",
      select: "id, qty, serial_no, device_id, devices(asset_code)",
      fields: [
        { name: "device_id", label: "Device", type: "ref", ref: DEVICE, required: true },
        { name: "serial_no", label: "Serial", ltr: true },
        { name: "qty", label: "Qty", type: "number", default: 1 },
      ],
      columns: [{ key: "devices.asset_code", label: "Device", kind: "ltr" }, { key: "serial_no", label: "Serial", kind: "ltr" }, { key: "qty", label: "Qty", kind: "num" }],
    },
    actions: [
      { id: "submit", label: "Submit", rpc: "fn_submit_installation_note", arg: "p_note_id", when: ["draft"], tone: "primary" },
      { id: "cancel", label: "Cancel", update: { status: "cancelled" }, when: ["draft"], tone: "danger" },
    ],
    editable: ["draft"], deletable: ["draft"],
  },
  {
    id: "maintenance-visits", table: "maintenance_visits", station: "service", label: "Visits", single: "New visit", icon: "stethoscope",
    select: "id, visit_no, visit_date, maintenance_type, completion_status, status, service_person, labs(name)",
    columns: [
      { key: "visit_no", label: "No.", kind: "ltr" }, { key: "visit_date", label: "Date", kind: "date" }, { key: "labs.name", label: "Lab" },
      { key: "maintenance_type", label: "Type", kind: "value" }, { key: "service_person", label: "Engineer" }, { key: "status", label: "Status", kind: "status" },
    ],
    search: ["visit_no", "service_person", "notes"], order: ["visit_date", false], title: "visit_no",
    fields: [
      { name: "visit_no", label: "No.", docKind: "mv", ltr: true, createOnly: true },
      { name: "lab_id", label: "Lab", type: "ref", ref: LAB },
      { name: "visit_date", label: "Date", type: "date", default: "today" },
      { name: "maintenance_type", label: "Type", type: "select", options: ["scheduled", "unscheduled", "breakdown"], default: "scheduled" },
      { name: "completion_status", label: "Completion", type: "select", options: ["pending", "partial", "full"], default: "pending" },
      { name: "service_person", label: "Engineer" },
      { name: "customer_feedback", label: "Customer feedback", type: "textarea", wide: true },
      { name: "notes", label: "Notes", type: "textarea", wide: true },
    ],
    lines: {
      table: "maintenance_visit_purposes", fk: "visit_id",
      select: "id, work_done, next_due_date, device_id, devices(asset_code)",
      fields: [
        { name: "device_id", label: "Device", type: "ref", ref: DEVICE },
        { name: "work_done", label: "Work done" },
        { name: "next_due_date", label: "Next due", type: "date" },
      ],
      columns: [{ key: "devices.asset_code", label: "Device", kind: "ltr" }, { key: "work_done", label: "Work done" }, { key: "next_due_date", label: "Next due", kind: "date" }],
    },
    actions: [
      { id: "submit", label: "Submit", rpc: "fn_submit_maintenance_visit", arg: "p_visit_id", when: ["draft"], tone: "primary" },
      { id: "cancel", label: "Cancel", update: { status: "cancelled" }, when: ["draft"], tone: "danger" },
    ],
    editable: ["draft"], deletable: ["draft"],
  },
  {
    id: "asset-repairs", table: "asset_repairs", station: "service", label: "Repairs", single: "New repair", icon: "hammer",
    select: "id, repair_no, failure_date, completion_date, repair_cost, status, devices(asset_code)",
    columns: [
      { key: "repair_no", label: "No.", kind: "ltr" }, { key: "devices.asset_code", label: "Device", kind: "ltr" },
      { key: "failure_date", label: "Failure date", kind: "date" }, { key: "repair_cost", label: "Cost", kind: "money" }, { key: "status", label: "Status", kind: "status" },
    ],
    search: ["repair_no", "description"], order: ["failure_date", false], title: "repair_no",
    fields: [
      { name: "repair_no", label: "No.", docKind: "rp", ltr: true, createOnly: true },
      { name: "device_id", label: "Device", type: "ref", ref: DEVICE, required: true },
      { name: "failure_date", label: "Failure date", type: "date", default: "today" },
      { name: "repair_cost", label: "Cost", type: "number", default: 0 },
      { name: "description", label: "Description", type: "textarea", wide: true },
      { name: "actions_performed", label: "Actions performed", type: "textarea", wide: true },
    ],
    actions: [
      { id: "complete", label: "Complete", rpc: "fn_complete_asset_repair", arg: "p_repair_id", when: ["pending"], tone: "primary" },
      { id: "cancel", label: "Cancel", update: { status: "cancelled" }, when: ["pending"], tone: "danger" },
    ],
    editable: ["pending"], deletable: ["pending", "cancelled"],
  },
  {
    id: "issues", table: "issues", station: "service", label: "Issues", single: "New issue", icon: "lifebuoy",
    select: "id, issue_no, subject, opening_date, priority, status, labs(name)",
    columns: [
      { key: "issue_no", label: "No.", kind: "ltr" }, { key: "subject", label: "Subject" }, { key: "labs.name", label: "Lab" },
      { key: "opening_date", label: "Opened", kind: "date" }, { key: "priority", label: "Priority", kind: "value" }, { key: "status", label: "Status", kind: "status" },
    ],
    search: ["issue_no", "subject", "description", "raised_by"], order: ["opening_date", false], title: "subject",
    fields: [
      { name: "issue_no", label: "No.", docKind: "is", ltr: true, createOnly: true },
      { name: "subject", label: "Subject", required: true, wide: true },
      { name: "lab_id", label: "Lab", type: "ref", ref: LAB },
      { name: "device_id", label: "Device", type: "ref", ref: DEVICE },
      { name: "priority", label: "Priority", type: "ref", ref: { table: "issue_priorities", label: "name", value: "name" } },
      { name: "issue_type", label: "Type", type: "ref", ref: { table: "issue_types", label: "name", value: "name" } },
      { name: "raised_by", label: "Raised by" },
      { name: "description", label: "Description", type: "textarea", wide: true },
      { name: "resolution_details", label: "Resolution", type: "textarea", wide: true },
    ],
    actions: [
      { id: "resolve", label: "Resolve", rpc: "fn_set_issue_status", arg: "p_id", args: { p_status: "resolved" }, when: ["open", "replied", "on_hold"], tone: "primary" },
      { id: "close", label: "Close", rpc: "fn_set_issue_status", arg: "p_id", args: { p_status: "closed" }, when: ["resolved"] },
    ],
  },

  // ── Manufacturing & quality ──────────────────────────────────────────
  {
    id: "boms", table: "boms", station: "manufacturing", label: "BOMs", single: "New BOM", icon: "factory",
    select: "id, bom_no, quantity, raw_material_cost, is_active, is_default, products(name)",
    columns: [
      { key: "bom_no", label: "No.", kind: "ltr" }, { key: "products.name", label: "Product" }, { key: "quantity", label: "Qty", kind: "num" },
      { key: "raw_material_cost", label: "Cost", kind: "money" }, { key: "is_active", label: "Active", kind: "bool" },
    ],
    search: ["bom_no", "description"], order: ["bom_no", true], title: "bom_no",
    fields: [
      { name: "bom_no", label: "No.", docKind: "bom", ltr: true, createOnly: true },
      { name: "product_id", label: "Product", type: "ref", ref: PRODUCT, required: true },
      { name: "quantity", label: "Qty", type: "number", default: 1 },
      { name: "is_active", label: "Active", type: "check", default: true },
      { name: "is_default", label: "Default", type: "check" },
      { name: "description", label: "Description", type: "textarea", wide: true },
    ],
    lines: {
      table: "bom_items", fk: "bom_id",
      select: "id, qty, rate, amount, component_id, products(name)",
      fields: [
        { name: "component_id", label: "Component", type: "ref", ref: PRODUCT_BUY, required: true },
        { name: "qty", label: "Qty", type: "number", required: true, default: 1 },
        { name: "rate", label: "Rate", type: "number", default: 0 },
      ],
      columns: [{ key: "products.name", label: "Component" }, { key: "qty", label: "Qty", kind: "num" }, { key: "rate", label: "Rate", kind: "money" }, { key: "amount", label: "Amount", kind: "money" }],
    },
  },
  {
    id: "work-orders", table: "work_orders", station: "manufacturing", label: "Work Orders", single: "New work order", icon: "wrench",
    select: "id, wo_no, qty, produced_qty, planned_start, status, products(name)",
    columns: [
      { key: "wo_no", label: "No.", kind: "ltr" }, { key: "products.name", label: "Product" }, { key: "qty", label: "Qty", kind: "num" },
      { key: "produced_qty", label: "Produced", kind: "num" }, { key: "planned_start", label: "Start", kind: "date" }, { key: "status", label: "Status", kind: "status" },
    ],
    search: ["wo_no", "notes"], order: ["created_at", false], title: "wo_no",
    fields: [
      { name: "wo_no", label: "No.", docKind: "wo", ltr: true, createOnly: true },
      { name: "product_id", label: "Product", type: "ref", ref: PRODUCT, required: true },
      { name: "bom_id", label: "BOM", type: "ref", ref: { table: "boms", label: "bom_no" } },
      { name: "qty", label: "Qty", type: "number", default: 1 },
      { name: "fg_warehouse", label: "Warehouse", type: "ref", ref: WAREHOUSE },
      { name: "planned_start", label: "Start", type: "date" },
      { name: "planned_end", label: "End", type: "date" },
      { name: "notes", label: "Notes", type: "textarea", wide: true },
    ],
    actions: [
      { id: "start", label: "Start", update: { status: "in_process" }, when: ["draft"], tone: "primary" },
      { id: "complete", label: "Complete", rpc: "fn_complete_work_order", arg: "p_wo_id", when: ["in_process"], confirm: "Complete this work order? Its materials are used and the product is added to stock.", tone: "primary" },
      { id: "cancel", label: "Cancel", update: { status: "cancelled" }, when: ["draft", "in_process"], tone: "danger" },
    ],
    editable: ["draft"], deletable: ["draft"],
  },
  {
    id: "quality-inspections", table: "quality_inspections", station: "manufacturing", label: "Quality", single: "New inspection", icon: "clipboardcheck",
    select: "id, qi_no, report_date, inspection_type, status, inspected_by, products(name)",
    columns: [
      { key: "qi_no", label: "No.", kind: "ltr" }, { key: "report_date", label: "Date", kind: "date" }, { key: "products.name", label: "Product" },
      { key: "inspection_type", label: "Type", kind: "value" }, { key: "status", label: "Status", kind: "status" },
    ],
    search: ["qi_no", "inspected_by", "remarks"], order: ["report_date", false], title: "qi_no",
    fields: [
      { name: "qi_no", label: "No.", docKind: "qi", ltr: true, createOnly: true },
      { name: "report_date", label: "Date", type: "date", default: "today" },
      { name: "inspection_type", label: "Type", type: "select", options: ["incoming", "outgoing", "in_process"], default: "incoming" },
      { name: "product_id", label: "Product", type: "ref", ref: PRODUCT },
      { name: "batch_id", label: "Batch", type: "ref", ref: { table: "kit_batches", label: "batch_no" } },
      { name: "sample_size", label: "Sample size", type: "number", default: 1 },
      { name: "inspected_by", label: "Inspected by" },
      { name: "remarks", label: "Remarks", type: "textarea", wide: true },
    ],
    actions: [
      { id: "accept", label: "Accept", update: { status: "accepted" }, when: ["pending"], tone: "primary" },
      { id: "reject", label: "Reject", update: { status: "rejected" }, when: ["pending"], tone: "danger" },
    ],
    editable: ["pending"], deletable: ["pending"],
  },

  // ── Accounts & reports ───────────────────────────────────────────────
  {
    id: "receivables", table: "sales_invoices", station: "accounts", label: "Receivables Aging", single: "", icon: "coins",
    select: "id, invoice_no, posting_date, due_date, outstanding, status, labs(name)",
    columns: [
      { key: "invoice_no", label: "Invoice", kind: "ltr" }, { key: "labs.name", label: "Lab" }, { key: "posting_date", label: "Date", kind: "date" },
      { key: "due_date", label: "Due date", kind: "date" }, { key: "outstanding", label: "Outstanding", kind: "money" }, { key: "status", label: "Status", kind: "status" },
    ],
    search: ["invoice_no"], order: ["due_date", true], title: "invoice_no", fields: [], readonly: true,
    where: [["status", "in", ["unpaid", "partly_paid"]], ["outstanding", "gt", 0]], opens: "sales-invoices",
  },
  {
    id: "payment-requests", table: "payment_requests", station: "accounts", label: "Payment Requests", single: "New payment request", icon: "card",
    select: "id, request_no, posting_date, amount, status, labs(name), sales_invoices(invoice_no)",
    columns: [
      { key: "request_no", label: "No.", kind: "ltr" }, { key: "posting_date", label: "Date", kind: "date" }, { key: "sales_invoices.invoice_no", label: "Invoice", kind: "ltr" },
      { key: "labs.name", label: "Lab" }, { key: "amount", label: "Amount", kind: "money" }, { key: "status", label: "Status", kind: "status" },
    ],
    search: ["request_no", "message"], order: ["posting_date", false], title: "request_no",
    fields: [
      { name: "request_no", label: "No.", docKind: "prq", ltr: true, createOnly: true },
      { name: "invoice_id", label: "Invoice", type: "ref", ref: { table: "sales_invoices", label: "invoice_no", fill: { amount: "outstanding", lab_id: "lab_id" } }, required: true },
      { name: "lab_id", label: "Lab", type: "ref", ref: LAB },
      { name: "amount", label: "Amount", type: "number", required: true },
      { name: "posting_date", label: "Date", type: "date", default: "today" },
      { name: "message", label: "Message", type: "textarea", wide: true },
    ],
    actions: [
      { id: "submit", label: "Submit", rpc: "fn_submit_payment_request", arg: "p_request_id", when: ["draft"], tone: "primary" },
      { id: "pay", label: "Mark paid", rpc: "fn_pay_payment_request", arg: "p_request_id", when: ["requested"], confirm: "Record this payment on the invoice?", tone: "primary" },
      { id: "cancel", label: "Cancel", update: { status: "cancelled" }, when: ["draft", "requested"], tone: "danger" },
    ],
    editable: ["draft"], deletable: ["draft"],
  },
  {
    id: "journal-entries", table: "journal_entries", station: "accounts", label: "Journal Entries", single: "New journal entry", icon: "book",
    select: "id, naming_series, posting_date, voucher_type, total_debit, total_credit, status",
    columns: [
      { key: "naming_series", label: "No.", kind: "ltr" }, { key: "posting_date", label: "Date", kind: "date" }, { key: "voucher_type", label: "Type", kind: "value" },
      { key: "total_debit", label: "Debit", kind: "money" }, { key: "total_credit", label: "Credit", kind: "money" }, { key: "status", label: "Status", kind: "status" },
    ],
    search: ["naming_series", "user_remark"], order: ["posting_date", false], title: "naming_series",
    fields: [
      { name: "naming_series", label: "No.", docKind: "je", ltr: true, createOnly: true },
      { name: "posting_date", label: "Date", type: "date", default: "today" },
      { name: "user_remark", label: "Remark", type: "textarea", wide: true },
    ],
    lines: {
      table: "journal_entry_accounts", fk: "journal_entry_id",
      select: "id, account, debit, credit, user_remark",
      fields: [
        { name: "account", label: "Account", type: "ref", ref: { table: "accounts", label: "account_name", code: "account_number", value: "account_name", where: { is_group: false, disabled: false } }, required: true },
        { name: "debit", label: "Debit", type: "number", default: 0 },
        { name: "credit", label: "Credit", type: "number", default: 0 },
      ],
      columns: [{ key: "account", label: "Account" }, { key: "debit", label: "Debit", kind: "money" }, { key: "credit", label: "Credit", kind: "money" }],
    },
    actions: [
      { id: "post", label: "Post", rpc: "fn_post_journal_entry", arg: "p_je_id", when: ["draft"], confirm: "Post this entry to the accounts?", tone: "primary" },
    ],
    editable: ["draft"], deletable: ["draft"],
  },
  {
    id: "accounts", table: "accounts", station: "accounts", label: "Accounts", single: "New account", icon: "book",
    select: "id, account_number, account_name, root_type, account_type, parent_account, is_group",
    columns: [
      { key: "account_number", label: "No.", kind: "ltr" }, { key: "account_name", label: "Name" }, { key: "root_type", label: "Type", kind: "value" },
      { key: "parent_account", label: "Parent" }, { key: "is_group", label: "Group", kind: "bool" },
    ],
    search: ["account_number", "account_name", "parent_account"], order: ["account_number", true], title: "account_name",
    fields: [
      { name: "account_name", label: "Name", required: true },
      { name: "account_number", label: "No.", ltr: true },
      { name: "root_type", label: "Type", type: "select", options: ["asset", "liability", "income", "expense", "equity"], required: true, default: "asset" },
      { name: "account_type", label: "Account type" },
      { name: "parent_account", label: "Parent" },
      { name: "is_group", label: "Group", type: "check" },
      { name: "currency", label: "Currency", type: "select", options: CURRENCIES, default: "USD" },
    ],
  },

  // ── Staff & shifts ───────────────────────────────────────────────────
  {
    id: "employees", table: "hr_employees", station: "hr", label: "Employees", single: "New employee", icon: "users",
    select: "id, code, full_name, job_title, department, phone, base_salary, currency, is_active",
    columns: [
      { key: "code", label: "Code", kind: "ltr" }, { key: "full_name", label: "Name" }, { key: "job_title", label: "Job title" },
      { key: "department", label: "Department" }, { key: "phone", label: "Phone", kind: "ltr" }, { key: "base_salary", label: "Salary", kind: "money" },
    ],
    search: ["code", "full_name", "job_title", "department", "phone"], order: ["full_name", true], title: "full_name",
    fields: [
      { name: "full_name", label: "Name", required: true },
      { name: "code", label: "Code", ltr: true },
      { name: "job_title", label: "Job title" },
      { name: "department", label: "Department" },
      { name: "phone", label: "Phone", type: "tel", ltr: true },
      { name: "hire_date", label: "Hire date", type: "date" },
      { name: "base_salary", label: "Salary", type: "number", default: 0 },
      { name: "currency", label: "Currency", type: "select", options: ["IQD", "USD"], default: "IQD" },
      { name: "is_active", label: "Active", type: "check", default: true },
      { name: "notes", label: "Notes", type: "textarea", wide: true },
    ],
  },
  {
    id: "leaves", table: "hr_leaves", station: "hr", label: "Leaves", single: "New leave", icon: "plane",
    select: "id, leave_type, from_date, to_date, note, hr_employees(full_name)",
    columns: [
      { key: "hr_employees.full_name", label: "Employee" }, { key: "leave_type", label: "Type", kind: "value" },
      { key: "from_date", label: "From", kind: "date" }, { key: "to_date", label: "To", kind: "date" }, { key: "note", label: "Note" },
    ],
    search: ["note"], order: ["from_date", false], title: "leave_type",
    fields: [
      { name: "employee_id", label: "Employee", type: "ref", ref: EMPLOYEE, required: true },
      { name: "leave_type", label: "Type", type: "select", options: ["annual", "sick", "emergency", "unpaid"], default: "annual" },
      { name: "from_date", label: "From", type: "date", required: true, default: "today" },
      { name: "to_date", label: "To", type: "date", required: true, default: "today" },
      { name: "note", label: "Note", wide: true },
    ],
    deletable: [],
  },
  {
    id: "advances", table: "hr_advances", station: "hr", label: "Advances", single: "New advance", icon: "banknote",
    select: "id, advance_date, amount, deduct_month, note, hr_employees(full_name)",
    columns: [
      { key: "hr_employees.full_name", label: "Employee" }, { key: "advance_date", label: "Date", kind: "date" },
      { key: "amount", label: "Amount", kind: "money" }, { key: "deduct_month", label: "Deduct in", kind: "ltr" },
    ],
    search: ["note", "deduct_month"], order: ["advance_date", false], title: "deduct_month",
    fields: [
      { name: "employee_id", label: "Employee", type: "ref", ref: EMPLOYEE, required: true },
      { name: "advance_date", label: "Date", type: "date", default: "today" },
      { name: "amount", label: "Amount", type: "number", required: true },
      { name: "deduct_month", label: "Deduct in (YYYY-MM)", required: true, ltr: true, default: "month" },
      { name: "note", label: "Note", wide: true },
    ],
    deletable: [],
  },
  {
    id: "shifts", table: "hr_shift_types", station: "hr", label: "Shifts & rules", single: "New shift", icon: "timer",
    select: "id, name, start_time, end_time",
    columns: [{ key: "name", label: "Name" }, { key: "start_time", label: "Start", kind: "ltr" }, { key: "end_time", label: "End", kind: "ltr" }],
    search: ["name"], order: ["start_time", true], title: "name",
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "start_time", label: "Start (HH:MM)", required: true, ltr: true, default: "08:00" },
      { name: "end_time", label: "End (HH:MM)", required: true, ltr: true, default: "14:00" },
    ],
    deletable: [],
  },

  // ── Cold chain & calibration ─────────────────────────────────────────
  {
    id: "cold-units", table: "cc_storage_units", station: "coldchain", label: "Fridges & stores", single: "New unit", icon: "fridge",
    select: "id, name, kind, min_temp, max_temp, is_active, warehouses(name)",
    columns: [
      { key: "name", label: "Name" }, { key: "kind", label: "Kind", kind: "value" }, { key: "warehouses.name", label: "Warehouse" },
      { key: "min_temp", label: "Min °C", kind: "num" }, { key: "max_temp", label: "Max °C", kind: "num" },
    ],
    search: ["name", "notes"], order: ["name", true], title: "name",
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "kind", label: "Kind", type: "select", options: ["fridge", "freezer", "room", "incubator", "other"], default: "fridge" },
      { name: "warehouse_id", label: "Warehouse", type: "ref", ref: WAREHOUSE },
      { name: "min_temp", label: "Min °C", type: "number", required: true, default: 2 },
      { name: "max_temp", label: "Max °C", type: "number", required: true, default: 8 },
      { name: "is_active", label: "Active", type: "check", default: true },
      { name: "notes", label: "Notes", type: "textarea", wide: true },
    ],
  },
  {
    id: "equipment", table: "cc_equipment", station: "coldchain", label: "Instruments & calibration", single: "New instrument", icon: "gauge",
    select: "id, name, model, serial_no, location, calib_months, last_calibrated",
    columns: [
      { key: "name", label: "Name" }, { key: "model", label: "Model" }, { key: "serial_no", label: "Serial", kind: "ltr" },
      { key: "location", label: "Location" }, { key: "last_calibrated", label: "Last calibrated", kind: "date" },
    ],
    search: ["name", "model", "serial_no", "location", "vendor"], order: ["name", true], title: "name",
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "model", label: "Model" },
      { name: "serial_no", label: "Serial", ltr: true },
      { name: "location", label: "Location" },
      { name: "vendor", label: "Vendor" },
      { name: "vendor_phone", label: "Vendor phone", type: "tel", ltr: true },
      { name: "installed_on", label: "Installed on", type: "date" },
      { name: "calib_months", label: "Calibrate every (months)", type: "number" },
      { name: "last_calibrated", label: "Last calibrated", type: "date" },
      { name: "is_active", label: "Active", type: "check", default: true },
      { name: "notes", label: "Notes", type: "textarea", wide: true },
    ],
  },

  // ── Guides & training ────────────────────────────────────────────────
  {
    id: "trainees", table: "kb_trainees", station: "guides", label: "Trainees", single: "New trainee", icon: "cap",
    select: "id, full_name, notes, hr_employees(full_name)",
    columns: [{ key: "full_name", label: "Name" }, { key: "hr_employees.full_name", label: "Employee" }, { key: "notes", label: "Notes" }],
    search: ["full_name", "notes"], order: ["full_name", true], title: "full_name",
    fields: [
      { name: "full_name", label: "Name", required: true },
      { name: "employee_id", label: "Employee", type: "ref", ref: EMPLOYEE },
      { name: "notes", label: "Notes", type: "textarea", wide: true },
    ],
    deletable: [],
  },
];

export const entityById = (id: string) => ENTITIES.find((e) => e.id === id);

/** Pages written by hand (not from the registry), per station. */
export const SPECIAL_PAGES: Record<string, { href: string; label: string; icon: string }[]> = {
  sales: [
    { href: "#/pos", label: "Point of Sale", icon: "cart" },
    { href: "#/sales", label: "Recent sales", icon: "receipt" },
  ],
  hr: [{ href: "#/attendance", label: "Attendance", icon: "clock" }],
  coldchain: [{ href: "#/temperatures", label: "Temperatures", icon: "thermo" }],
  guides: [{ href: "#/guides", label: "Guides", icon: "book" }],
};

/** Every page of a station in the web app: its hand-written pages, then its lists. */
export function stationPages(station: string): { href: string; label: string; icon: string }[] {
  return [
    ...(SPECIAL_PAGES[station] ?? []),
    ...ENTITIES.filter((e) => e.station === station).map((e) => ({ href: `#/e/${e.id}`, label: e.label, icon: e.icon })),
  ];
}
