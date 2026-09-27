"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeftRightIcon, BanknoteIcon, BookOpenIcon, BoxesIcon, Building2Icon, CalendarDaysIcon, ClipboardCheckIcon, ClipboardListIcon,
  ClockIcon, CoinsIcon, CreditCardIcon, FactoryIcon, FileSignatureIcon, FileTextIcon, FlaskConicalIcon, GaugeIcon, GraduationCapIcon,
  HammerIcon, LifeBuoyIcon, ListIcon, MonitorIcon, PackageIcon, PackagePlusIcon, PencilIcon, PlaneIcon, PlugIcon, PlusIcon,
  ReceiptIcon, RefrigeratorIcon, ScrollTextIcon, ShoppingCartIcon, StethoscopeIcon, ThermometerSnowflakeIcon, TimerIcon, Trash2Icon,
  UserPlusIcon, UsersIcon, WarehouseIcon, WrenchIcon, XIcon, type LucideIcon,
} from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { t, tValue, tStatus } from "@/lib/i18n";
import { localDate } from "@/lib/dates";
import type { PgRestClient } from "@/lib/db/rest-core";
import type { Action, Column, Entity, Field, Ref } from "@/lib/local/registry";
import { useLocalQuery, useRuntime } from "./hooks";
import { Card, Pager, SearchBox, PAGE, fmtMoney } from "./parts";

/**
 * The generic screens of the web app: a registry entry (src/lib/local/registry.ts)
 * becomes its list (search, pages), its form (fields, and a document's lines),
 * and its record page (details, lines, the buttons its status allows) — all
 * on the database in this browser.
 */

export const ICONS: Record<string, LucideIcon> = {
  flask: FlaskConicalIcon, userplus: UserPlusIcon, calendar: CalendarDaysIcon, file: FileTextIcon, clipboard: ClipboardListIcon,
  receipt: ReceiptIcon, signature: FileSignatureIcon, building: Building2Icon, package: PackageIcon, warehouse: WarehouseIcon,
  boxes: BoxesIcon, list: ListIcon, scroll: ScrollTextIcon, packageplus: PackagePlusIcon, arrows: ArrowLeftRightIcon,
  monitor: MonitorIcon, plug: PlugIcon, stethoscope: StethoscopeIcon, hammer: HammerIcon, lifebuoy: LifeBuoyIcon,
  factory: FactoryIcon, wrench: WrenchIcon, clipboardcheck: ClipboardCheckIcon, coins: CoinsIcon, card: CreditCardIcon,
  book: BookOpenIcon, users: UsersIcon, plane: PlaneIcon, banknote: BanknoteIcon, timer: TimerIcon, fridge: RefrigeratorIcon,
  gauge: GaugeIcon, cap: GraduationCapIcon, cart: ShoppingCartIcon, clock: ClockIcon, thermo: ThermometerSnowflakeIcon,
};

type Row = Record<string, unknown>;
type Loc = ReturnType<typeof useLocale>;

// ---------------------------------------------------------------- values
export function get(row: Row | null | undefined, key: string): unknown {
  let v: unknown = row;
  for (const k of key.split(".")) v = v == null ? v : (v as Row)[k];
  return v;
}

const pad = (n: number) => String(n).padStart(2, "0");
function toLocalInput(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initial(f: Field): unknown {
  const d = f.default;
  if (d === "today") return localDate();
  if (d === "now") return toLocalInput(new Date().toISOString());
  if (d === "month") return localDate().slice(0, 7);
  if (f.type === "check") return d === true;
  return d == null ? "" : String(d);
}

function fromRow(f: Field, v: unknown): unknown {
  if (f.type === "check") return v === true;
  if (f.type === "datetime") return toLocalInput(v);
  if (f.type === "date") return v ? String(v).slice(0, 10) : "";
  if (f.type === "time") return v ? String(v).slice(0, 5) : "";
  return v == null ? "" : String(v);
}

/** The value written to the database, or undefined when a required one is missing. */
function toDb(f: Field, v: unknown): unknown {
  if (f.type === "check") return v === true;
  const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v);
  if (s === "") return null;
  if (f.type === "number") return Number(s);
  if (f.type === "datetime") return new Date(s).toISOString();
  return s;
}

export function formatCell(locale: Loc, c: Column, row: Row): ReactNode {
  const v = get(row, c.key);
  if (v == null || v === "") return "—";
  switch (c.kind) {
    case "money": return <span className="tabular-nums">{fmtMoney(v)}</span>;
    case "num": return <span className="tabular-nums">{Number(v).toLocaleString("en-US", { maximumFractionDigits: 3 })}</span>;
    case "date": return <span dir="ltr" className="tabular-nums">{String(v).slice(0, 10)}</span>;
    case "datetime": return <span dir="ltr" className="tabular-nums">{toLocalInput(v).replace("T", " ")}</span>;
    case "status": return <StatusPill status={String(v)} />;
    case "value": return tValue(locale, String(v));
    case "ltr": return <span dir="ltr">{String(v)}</span>;
    case "bool": return v ? "✓" : "—";
    default: return String(v);
  }
}

const TONE: Record<string, string> = {
  draft: "bg-surface-gray-2 text-ink-gray-6", pending: "bg-amber-50 text-amber-700", open: "bg-sky-50 text-sky-700",
  cancelled: "bg-red-50 text-red-700", lost: "bg-red-50 text-red-700", rejected: "bg-red-50 text-red-700", inactive: "bg-surface-gray-2 text-ink-gray-6",
  paid: "bg-emerald-50 text-emerald-700", delivered: "bg-emerald-50 text-emerald-700", completed: "bg-emerald-50 text-emerald-700",
  received: "bg-emerald-50 text-emerald-700", posted: "bg-emerald-50 text-emerald-700", accepted: "bg-emerald-50 text-emerald-700",
  resolved: "bg-emerald-50 text-emerald-700", active: "bg-emerald-50 text-emerald-700", closed: "bg-surface-gray-2 text-ink-gray-6",
  unpaid: "bg-amber-50 text-amber-700", partly_paid: "bg-amber-50 text-amber-700",
};
export function StatusPill({ status }: { status: string }) {
  const locale = useLocale();
  return <span data-status={status} className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TONE[status] ?? "bg-brand-light text-brand"}`}>{tStatus(locale, status)}</span>;
}

// ---------------------------------------------------------------- the list
export function EntityList({ e }: { e: Entity }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const from = (page - 1) * PAGE;
  const { data, count, error } = useLocalQuery<Row[]>((c) => {
    let x = c.from(e.table).select(e.select, { count: "exact" }).search(e.search, q);
    for (const [col, op, val] of e.where ?? []) x = op === "in" ? x.in(col, val as unknown[]) : op === "gt" ? x.gt(col, val) : op === "neq" ? x.neq(col, val) : x.eq(col, val);
    return x.order(e.order[0], { ascending: e.order[1] }).range(from, from + PAGE - 1);
  }, [e.id, q, page]);
  const open = e.readonly ? e.opens ?? null : e.id;
  return (
    <Card title={`${T(e.label)} (${count.toLocaleString("en-US")})`} actions={
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} />
        {!e.readonly && (
          <a href={`#/e/${e.id}/new`} data-testid="entity-new" className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark">
            <PlusIcon size={14} /> {T(e.single)}
          </a>
        )}
      </div>
    }>
      <div data-testid={`list-${e.id}`}>
        {error && <p role="alert" className="p-4 text-sm text-red-600">{error}</p>}
        {!data ? <p className="p-6 text-center text-sm text-ink-gray-5">{T("Loading…")}</p> : !data.length ? (
          <p className="p-6 text-center text-sm text-ink-gray-5">{T(q ? "No results" : "Nothing here yet")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-ink-gray-4">{e.columns.map((c) => <th key={c.key} className="px-4 py-2 text-start font-medium">{T(c.label)}</th>)}</tr></thead>
              <tbody className="divide-y divide-outline-gray-1">
                {data.map((r, i) => (
                  <tr key={String(r.id ?? i)} className={open ? "cursor-pointer hover:bg-surface-gray-1" : ""} onClick={open ? () => { window.location.hash = `/e/${open}/${r.id}`; } : undefined}>
                    {e.columns.map((c, j) => (
                      <td key={c.key} className="px-4 py-2">
                        {j === 0 && open ? <a href={`#/e/${open}/${r.id}`} className="font-medium text-brand hover:underline">{formatCell(locale, c, r)}</a> : formatCell(locale, c, r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Pager page={page} total={count} onPage={setPage} />
    </Card>
  );
}

// ---------------------------------------------------------------- a reference picker
function RefPicker({ r, value, onChange, required, name }: { r: Ref; value: string; onChange: (v: string, row: Row | null) => void; required?: boolean; name: string }) {
  const locale = useLocale();
  const rt = useRuntime([]);
  const [label, setLabel] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const key = r.value ?? "id";
  const cols = [...new Set([key, r.label, r.code, ...Object.values(r.fill ?? {})].filter(Boolean))].join(", ");
  const show = (row: Row) => `${String(row[r.label] ?? "")}${r.code && row[r.code] ? ` (${String(row[r.code])})` : ""}`;

  // The label of a value already chosen (a record being edited, a value filled in).
  useEffect(() => {
    if (!value) { setLabel(""); return; }
    if (key === r.label) { setLabel(value); return; }
    let live = true;
    void rt.client?.from(r.table).select(cols).eq(key, value).limit(1).then(({ data }) => {
      const row = (data as Row[] | null)?.[0];
      if (live && row) setLabel(show(row));
    });
    return () => { live = false; };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    let live = true;
    const id = setTimeout(() => {
      let x = rt.client!.from(r.table).select(cols).search([r.label, ...(r.code ? [r.code] : [])], q);
      for (const [k, v] of Object.entries(r.where ?? {})) x = x.eq(k, v);
      void x.order(r.label).limit(20).then(({ data }) => { if (live) setRows((data as Row[] | null) ?? []); });
    }, 150);
    return () => { live = false; clearTimeout(id); };
  }, [q, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const cls = "w-full rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2 text-sm outline-none focus:border-brand";
  return (
    <div className="relative">
      <input data-ref={name} value={open ? q : label} placeholder={open ? label || t(locale, "Search") + "…" : "—"} required={required && !value}
        onFocus={() => { setQ(""); setOpen(true); }} onChange={(ev) => setQ(ev.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} className={cls} autoComplete="off" />
      {value && !required && (
        <button type="button" aria-label={t(locale, "Clear")} onClick={() => { onChange("", null); setLabel(""); }} className="absolute top-1/2 -translate-y-1/2 text-ink-gray-4 end-2"><XIcon size={14} /></button>
      )}
      {open && (
        <ul role="listbox" className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-outline-gray-2 bg-surface-white py-1 shadow-lg">
          {rows.length === 0 && <li className="px-3 py-2 text-xs text-ink-gray-5">{t(locale, "No results")}</li>}
          {rows.map((row) => (
            <li key={String(row[key])} role="option" aria-selected={String(row[key]) === value}
              onMouseDown={(ev) => { ev.preventDefault(); onChange(String(row[key]), row); setLabel(show(row)); setOpen(false); }}
              className="cursor-pointer px-3 py-1.5 text-sm hover:bg-brand-light">{show(row)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- one field
function FieldInput({ f, value, set, onPick }: { f: Field; value: unknown; set: (v: unknown) => void; onPick?: (row: Row | null) => void }) {
  const locale = useLocale();
  const cls = "w-full rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2 text-sm outline-none focus:border-brand";
  const common = { name: f.name, required: f.required, dir: f.ltr ? "ltr" : undefined, className: cls };
  switch (f.type) {
    case "ref":
      return <RefPicker name={f.name} r={f.ref!} value={String(value ?? "")} required={f.required} onChange={(v, row) => { set(v); onPick?.(row); }} />;
    case "select":
      return (
        <select {...common} value={String(value ?? "")} onChange={(ev) => set(ev.target.value)}>
          {!f.required && !f.default && <option value="">—</option>}
          {f.options!.map((o) => <option key={o} value={o}>{/^[A-Z]{3}$/.test(o) ? t(locale, o) : tValue(locale, o)}</option>)}
        </select>
      );
    case "check":
      return <input type="checkbox" name={f.name} checked={value === true} onChange={(ev) => set(ev.target.checked)} className="size-4 accent-brand" />;
    case "textarea":
      return <textarea {...common} rows={3} value={String(value ?? "")} onChange={(ev) => set(ev.target.value)} />;
    case "number":
      return <input {...common} dir="ltr" type="number" step="any" inputMode="decimal" value={String(value ?? "")} onChange={(ev) => set(ev.target.value)} />;
    case "date":
      return <input {...common} dir="ltr" type="date" value={String(value ?? "")} onChange={(ev) => set(ev.target.value)} />;
    case "datetime":
      return <input {...common} dir="ltr" type="datetime-local" value={String(value ?? "")} onChange={(ev) => set(ev.target.value)} />;
    case "time":
      return <input {...common} dir="ltr" type="time" value={String(value ?? "")} onChange={(ev) => set(ev.target.value)} />;
    default:
      return <input {...common} type={f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text"} value={String(value ?? "")} onChange={(ev) => set(ev.target.value)} />;
  }
}

/** Apply a picked row's `fill` columns to sibling values. */
function filled(f: Field, row: Row | null, vals: Row): Row {
  if (!row || !f.ref?.fill) return vals;
  const next = { ...vals };
  for (const [field, col] of Object.entries(f.ref.fill)) if (row[col] != null) next[field] = String(row[col]);
  return next;
}

async function nextNumber(c: PgRestClient, kind: string): Promise<string | null> {
  const { data } = await c.rpc("fn_next_doc_no", { p_kind: kind });
  if (typeof data === "string") return data;
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === "object" ? String(Object.values(row as Row)[0]) : null;
}

// ---------------------------------------------------------------- the form
export function EntityForm({ e, id }: { e: Entity; id?: string }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const rt = useRuntime([]);
  const fields = e.fields.filter((f) => !(id && f.createOnly));
  const [vals, setVals] = useState<Row>(() => Object.fromEntries(e.fields.map((f) => [f.name, initial(f)])));
  const blankLine = () => Object.fromEntries((e.lines?.fields ?? []).map((f) => [f.name, initial(f)]));
  const [lines, setLines] = useState<Row[]>(() => (e.lines ? [blankLine()] : []));
  const [loaded, setLoaded] = useState(!id);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id || !rt.client) return;
    void (async () => {
      const { data } = await rt.client!.from(e.table).select("*").eq("id", id).single();
      if (data) setVals(Object.fromEntries(e.fields.map((f) => [f.name, fromRow(f, (data as Row)[f.name])])));
      if (e.lines) {
        const { data: ls } = await rt.client!.from(e.lines.table).select("*").eq(e.lines.fk, id);
        const rows = ((ls as Row[] | null) ?? []).map((l) => Object.fromEntries(e.lines!.fields.map((f) => [f.name, fromRow(f, l[f.name])])));
        setLines(rows.length ? rows : [blankLine()]);
      }
      setLoaded(true);
    })();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const qtyRate = e.lines?.fields.some((f) => f.name === "qty") && e.lines.fields.some((f) => f.name === "rate");
  const total = qtyRate ? lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0) : 0;

  async function save() {
    const c = rt.client;
    if (!c) return;
    setErr("");
    const row: Row = {};
    for (const f of fields) {
      const v = toDb(f, vals[f.name]);
      if (v == null && f.required) { setErr(`${T("Required")}: ${T(f.label)}`); return; }
      row[f.name] = v;
    }
    let items: Row[] = [];
    if (e.lines) {
      const first = e.lines.fields[0];
      items = lines.filter((l) => toDb(first, l[first.name]) != null).map((l) => Object.fromEntries(e.lines!.fields.map((f) => [f.name, toDb(f, l[f.name])])));
      const missing = items.flatMap((l) => e.lines!.fields.filter((f) => f.required && l[f.name] == null));
      if (missing.length) { setErr(`${T("Required")}: ${T(missing[0].label)}`); return; }
      if (!items.length) { setErr(T("Add at least one line")); return; }
    }
    setBusy(true);
    try {
      let rid = id;
      if (!id) {
        for (const f of fields) if (f.docKind && row[f.name] == null) row[f.name] = await nextNumber(c, f.docKind);
        const { data, error } = await c.from(e.table).insert(row).select("id").single();
        if (error) throw new Error(error.message);
        rid = String((data as Row).id);
      } else {
        const { error } = await c.from(e.table).update(row).eq("id", id);
        if (error) throw new Error(error.message);
      }
      if (e.lines) {
        if (id) {
          const { error } = await c.from(e.lines.table).delete().eq(e.lines.fk, id);
          if (error) throw new Error(error.message);
        }
        const { error } = await c.from(e.lines.table).insert(items.map((l) => ({ ...l, [e.lines!.fk]: rid })));
        if (error) throw new Error(error.message);
      }
      window.location.hash = `/e/${e.id}/${rid}`;
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <p className="text-sm text-ink-gray-5">{T("Loading…")}</p>;
  return (
    <form data-testid={`form-${e.id}`} onSubmit={(ev) => { ev.preventDefault(); void save(); }} className="space-y-4">
      <Card title={id ? `${T("Edit")} — ${String(vals[e.title] || "")}` : T(e.single)} actions={<a href={id ? `#/e/${e.id}/${id}` : `#/e/${e.id}`} className="text-sm text-brand">{T("Back")}</a>}>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {fields.map((f) => (
            <label key={f.name} className={`block ${f.wide ? "sm:col-span-2" : ""} ${f.type === "check" ? "flex items-center gap-2 pt-5" : ""}`}>
              <span className="text-xs text-ink-gray-5">{T(f.label)}{f.required && <span className="text-red-500"> *</span>}{f.docKind && !id && <span className="text-ink-gray-4"> — {T("left blank, it is numbered")}</span>}</span>
              <FieldInput f={f} value={vals[f.name]} set={(v) => setVals((s) => ({ ...s, [f.name]: v }))}
                onPick={(row) => setVals((s) => filled(f, row, { ...s }))} />
            </label>
          ))}
        </div>
      </Card>
      {e.lines && (
        <Card title={T("Lines")} actions={qtyRate ? <span className="text-sm font-semibold tabular-nums">{T("Total")}: {fmtMoney(total)}</span> : undefined}>
          <div className="overflow-x-auto" data-testid="lines">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-ink-gray-4">{e.lines.fields.map((f) => <th key={f.name} className="px-3 py-2 text-start font-medium">{T(f.label)}</th>)}<th /></tr></thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} data-line={i}>
                    {e.lines!.fields.map((f) => (
                      <td key={f.name} className={`px-3 py-1.5 align-top ${f.type === "ref" ? "min-w-56" : "min-w-24"}`}>
                        <FieldInput f={f} value={l[f.name]}
                          set={(v) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, [f.name]: v } : x)))}
                          onPick={(row) => setLines((ls) => ls.map((x, j) => (j === i ? filled(f, row, x) : x)))} />
                      </td>
                    ))}
                    <td className="px-2 py-1.5 align-top">
                      <button type="button" aria-label={T("Remove")} onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : [blankLine()]))}
                        className="rounded p-2 text-ink-gray-4 hover:text-red-600"><Trash2Icon size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-outline-gray-1 px-4 py-2">
            <button type="button" data-testid="add-line" onClick={() => setLines((ls) => [...ls, blankLine()])} className="inline-flex items-center gap-1 text-sm text-brand"><PlusIcon size={14} /> {T("Add line")}</button>
          </div>
        </Card>
      )}
      <div className="flex items-center gap-3">
        <button disabled={busy} className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">{busy ? T("Saving…") : T("Save")}</button>
        {err && <span role="alert" className="text-sm text-red-600">{err}</span>}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- the record
/** What the record page reads: every column, and each reference's label. */
function recordSelect(e: Entity): string {
  const embeds = e.fields.filter((f) => f.type === "ref" && !f.ref!.value).map((f) => `r_${f.name}:${f.name}(${[f.ref!.label, f.ref!.code].filter(Boolean).join(", ")})`);
  return ["*", ...embeds].join(", ");
}

export function EntityRecord({ e, id }: { e: Entity; id: string }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const rt = useRuntime([]);
  const sel = useMemo(() => recordSelect(e), [e]);
  const { data: row, loading } = useLocalQuery<Row>((c) => c.from(e.table).select(sel).eq("id", id).single(), [e.id, id]);
  const lines = useLocalQuery<Row[]>((c) => (e.lines ? c.from(e.lines.table).select(e.lines.select).eq(e.lines.fk, id) : Promise.resolve({ data: [], error: null })), [e.id, id]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [ask, setAsk] = useState<Action | null>(null);
  const askRef = useRef<HTMLInputElement>(null);

  if (loading && !row) return <p className="text-sm text-ink-gray-5">{T("Loading…")}</p>;
  if (!row) return <p className="text-sm text-ink-gray-5">{T("Not found")}</p>;
  const status = typeof row.status === "string" ? row.status : null;
  const can = (list?: string[]) => (list ? list.length > 0 && (!status || list.includes(status)) : false);
  const editable = e.editable ? can(e.editable) : true;
  const deletable = can(e.deletable);
  const actions = (e.actions ?? []).filter((a) => !a.when || (status && a.when.includes(status)));

  async function run(a: Action, input?: string) {
    const c = rt.client;
    if (!c) return;
    if (a.confirm && !input && !window.confirm(T(a.confirm))) return;
    setErr(""); setBusy(a.id);
    try {
      if (a.rpc) {
        await rt.setActor();
        const args: Row = { [a.arg ?? "p_id"]: id, ...(a.args ?? {}) };
        if (a.input) args[a.input.name] = Number(input);
        if (a.numbered) args[a.numbered.name] = await nextNumber(c, a.numbered.kind);
        const { data, error } = await c.rpc(a.rpc, args);
        if (error) throw new Error(error.message);
        rt.afterWrite();
        const made = typeof data === "string" ? data : Array.isArray(data) ? (data[0] as Row | undefined)?.id : (data as Row | null)?.id;
        if (a.opens && made) window.location.hash = `/e/${a.opens}/${String(made)}`;
      } else if (a.update) {
        const { error } = await c.from(e.table).update(a.update).eq("id", id);
        if (error) throw new Error(error.message);
      }
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(""); setAsk(null);
    }
  }

  async function remove() {
    if (!window.confirm(T("Delete this record?"))) return;
    const { error } = await rt.client!.from(e.table).delete().eq("id", id);
    if (error) setErr(error.message);
    else window.location.hash = `/e/${e.id}`;
  }

  const shown = e.fields.filter((f) => f.name !== e.title);
  const value = (f: Field): ReactNode => {
    if (f.type === "ref" && !f.ref!.value) {
      const r = row[`r_${f.name}`] as Row | null;
      return r ? `${String(r[f.ref!.label] ?? "")}${f.ref!.code && r[f.ref!.code] ? ` (${String(r[f.ref!.code])})` : ""}` : "—";
    }
    const kind = f.type === "number" ? "num" : f.type === "date" ? "date" : f.type === "datetime" ? "datetime" : f.type === "check" ? "bool" : f.type === "select" ? (f.name === "status" ? "status" : "value") : f.ltr ? "ltr" : undefined;
    if (f.type === "select" && f.options?.every((o) => /^[A-Z]{3}$/.test(o))) return row[f.name] ? T(String(row[f.name])) : "—";
    return formatCell(locale, { key: f.name, label: f.label, kind }, row);
  };
  const btn = (tone?: string) => `rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${tone === "primary" ? "bg-brand text-white hover:bg-brand-dark" : tone === "danger" ? "border border-red-200 text-red-700 hover:bg-red-50" : "border border-outline-gray-2 text-ink-gray-7 hover:bg-surface-gray-1"}`;

  return (
    <div className="space-y-4" data-testid={`record-${e.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <a href={`#/e/${e.id}`} className="text-sm text-ink-gray-5 hover:text-brand">{T(e.label)}</a>
          <span className="text-ink-gray-4">/</span>
          <h1 className="text-lg font-bold text-ink-gray-9" data-testid="record-title">{String(row[e.title] ?? "—")}</h1>
          {status && <StatusPill status={status} />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions.map((a) => (
            <button key={a.id} data-action={a.id} disabled={!!busy} onClick={() => (a.input ? setAsk(a) : void run(a))} className={btn(a.tone)}>
              {busy === a.id ? T("Working…") : T(a.label)}
            </button>
          ))}
          {editable && e.fields.length > 0 && <a href={`#/e/${e.id}/${id}/edit`} data-action="edit" className={`${btn()} inline-flex items-center gap-1`}><PencilIcon size={13} /> {T("Edit")}</a>}
          {deletable && <button data-action="delete" onClick={() => void remove()} className={`${btn("danger")} inline-flex items-center gap-1`}><Trash2Icon size={13} /> {T("Delete")}</button>}
        </div>
      </div>
      {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      {ask && (
        <form className="flex flex-wrap items-end gap-2 rounded-xl border border-brand/30 bg-brand-light/40 p-3" onSubmit={(ev) => { ev.preventDefault(); void run(ask, askRef.current?.value); }}>
          <label className="block">
            <span className="text-xs text-ink-gray-6">{T(ask.input!.label)}</span>
            <input ref={askRef} name={ask.input!.name} type="number" step="any" dir="ltr" required autoFocus defaultValue={ask.input!.from ? String(row[ask.input!.from] ?? "") : ""}
              className="block rounded-lg border border-outline-gray-2 px-3 py-1.5 text-sm" />
          </label>
          <button className={btn("primary")}>{T(ask.label)}</button>
          <button type="button" onClick={() => setAsk(null)} className={btn()}>{T("Cancel")}</button>
        </form>
      )}
      <Card title={T("Details")}>
        <dl className="grid gap-x-6 gap-y-2 p-4 text-sm sm:grid-cols-2">
          {shown.map((f) => (
            <div key={f.name} className={`flex justify-between gap-3 border-b border-outline-gray-1 py-1.5 ${f.wide ? "sm:col-span-2" : ""}`}>
              <dt className="text-ink-gray-5">{T(f.label)}</dt>
              <dd className="text-end" data-field={f.name}>{value(f)}</dd>
            </div>
          ))}
          {typeof row.total_amount !== "undefined" && (
            <div className="flex justify-between gap-3 border-b border-outline-gray-1 py-1.5"><dt className="text-ink-gray-5">{T("Total")}</dt><dd className="font-semibold tabular-nums" data-field="total_amount">{fmtMoney(row.total_amount)}</dd></div>
          )}
          {typeof row.outstanding !== "undefined" && (
            <div className="flex justify-between gap-3 border-b border-outline-gray-1 py-1.5"><dt className="text-ink-gray-5">{T("Outstanding")}</dt><dd className="tabular-nums" data-field="outstanding">{fmtMoney(row.outstanding)}</dd></div>
          )}
        </dl>
      </Card>
      {e.lines && (
        <Card title={T("Lines")}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-ink-gray-4">{e.lines.columns.map((c) => <th key={c.key} className="px-4 py-2 text-start font-medium">{T(c.label)}</th>)}</tr></thead>
              <tbody className="divide-y divide-outline-gray-1">
                {(lines.data ?? []).map((l, i) => <tr key={String(l.id ?? i)}>{e.lines!.columns.map((c) => <td key={c.key} className="px-4 py-2">{formatCell(locale, c, l)}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
