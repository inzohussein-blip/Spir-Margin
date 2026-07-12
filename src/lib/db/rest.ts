import "server-only";
import { getDb, type FkMeta } from "./pglite";

/**
 * A small subset of the supabase-js (PostgREST) query builder implemented over
 * PGlite. Supports the exact surface this app uses: select with embedded
 * resources (to-one objects / to-many arrays, aliases, nesting), the common
 * filters, order/limit/single, insert/update/delete, and rpc().
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Result = { data: any; error: { message: string } | null; count?: number };

const q = (id: string) => `"${id.replace(/"/g, '""')}"`;

// ---- select-string parsing -------------------------------------------------

interface Field {
  raw: string;
  alias?: string;
  name: string; // column name, table/fk token, or "*"
  sub?: Field[]; // present => embedded resource
}

/** Split a comma list at top level (ignoring commas inside parentheses). */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0,
    cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

function parseFields(sel: string): Field[] {
  return splitTop(sel).map((tokenRaw) => {
    const token = tokenRaw.trim();
    const paren = token.indexOf("(");
    if (paren !== -1 && token.endsWith(")")) {
      const head = token.slice(0, paren).trim();
      const inner = token.slice(paren + 1, -1);
      const [aliasOrName, maybeName] = head.split(":").map((x) => x.trim());
      const alias = maybeName ? aliasOrName : undefined;
      const name = maybeName ? maybeName : aliasOrName;
      return { raw: token, alias, name, sub: parseFields(inner) };
    }
    const [aliasOrName, maybeName] = token.split(":").map((x) => x.trim());
    const alias = maybeName ? aliasOrName : undefined;
    const name = maybeName ? maybeName : aliasOrName;
    return { raw: token, alias, name };
  });
}

// ---- embed resolution ------------------------------------------------------

interface Embed {
  kind: "one" | "many";
  ftable: string;
  joinCol: string; // for "one": parent.<joinCol> = ftable.id ; for "many": ftable.<joinCol> = parent.id
}

function resolveEmbed(meta: FkMeta, parent: string, name: string): Embed | null {
  const parentCols = meta.columns[parent];
  // 1) token is a FK column on the parent -> to-one via that column
  if (parentCols?.has(name)) {
    const fk = (meta.outgoing[parent] ?? []).find((f) => f.column === name);
    if (fk) return { kind: "one", ftable: fk.ftable, joinCol: name };
  }
  // 2) token is a table name
  if (meta.tables.has(name)) {
    const out = (meta.outgoing[parent] ?? []).filter((f) => f.ftable === name);
    if (out.length === 1) return { kind: "one", ftable: name, joinCol: out[0].column };
    const inc = (meta.outgoing[name] ?? []).filter((f) => f.ftable === parent);
    if (inc.length >= 1) return { kind: "many", ftable: name, joinCol: inc[0].column };
    if (out.length > 1) return { kind: "one", ftable: name, joinCol: out[0].column };
  }
  return null;
}

/** Build the comma-separated SELECT field SQL for a table (recursing embeds). */
function buildFields(meta: FkMeta, table: string, fields: Field[]): string {
  const parts: string[] = [];
  for (const f of fields) {
    if (f.name === "*" && !f.sub) {
      parts.push(`${q(table)}.*`);
      continue;
    }
    if (!f.sub) {
      parts.push(`${q(table)}.${q(f.name)}`);
      continue;
    }
    const emb = resolveEmbed(meta, table, f.name);
    const key = f.alias ?? f.name;
    if (!emb) {
      // unknown embed -> emit null so the shape still matches
      parts.push(`null as ${q(key)}`);
      continue;
    }
    const sub = buildFields(meta, emb.ftable, f.sub);
    if (emb.kind === "one") {
      parts.push(
        `(select to_jsonb(_e) from (select ${sub} from ${q(emb.ftable)} ` +
          `where ${q(emb.ftable)}.${q("id")} = ${q(table)}.${q(emb.joinCol)}) _e) as ${q(key)}`
      );
    } else {
      parts.push(
        `(select coalesce(jsonb_agg(_e), '[]'::jsonb) from (select ${sub} from ${q(emb.ftable)} ` +
          `where ${q(emb.ftable)}.${q(emb.joinCol)} = ${q(table)}.${q("id")}) _e) as ${q(key)}`
      );
    }
  }
  return parts.join(", ");
}

// ---- builder ---------------------------------------------------------------

interface Filter {
  col: string;
  op: "eq" | "neq" | "in" | "gt" | "lt" | "gte" | "lte" | "is";
  val: unknown;
}
interface Order {
  col: string;
  asc: boolean;
  nullsFirst?: boolean;
}

class Query implements PromiseLike<Result> {
  private op: "select" | "insert" | "update" | "delete" = "select";
  private selectStr = "*";
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private limitN?: number;
  private singleRow = false;
  private payload: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private updateVals: Record<string, unknown> | null = null;
  private returning = false;
  private conflictTarget?: string;
  private ignoreDup = false;
  private wantCount = false;
  private rpcSpec?: { fn: string; params: Record<string, unknown> };

  constructor(private table: string) {}

  _asRpc(fn: string, params: Record<string, unknown>) {
    this.rpcSpec = { fn, params };
    return this;
  }

  select(cols = "*") {
    if (this.op === "insert" || this.op === "update" || this.op === "delete") {
      this.returning = true;
      if (cols !== "*") this.selectStr = cols;
      return this;
    }
    this.op = "select";
    this.selectStr = cols;
    return this;
  }
  insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  update(vals: Record<string, unknown>) {
    this.op = "update";
    this.updateVals = vals;
    return this;
  }
  upsert(
    payload: Record<string, unknown> | Record<string, unknown>[],
    opts?: { onConflict?: string; ignoreDuplicates?: boolean; count?: string }
  ) {
    this.op = "insert";
    this.payload = payload;
    this.conflictTarget = opts?.onConflict;
    this.ignoreDup = opts?.ignoreDuplicates ?? false;
    if (opts?.count) this.wantCount = true;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(col: string, val: unknown) { this.filters.push({ col, op: "eq", val }); return this; }
  neq(col: string, val: unknown) { this.filters.push({ col, op: "neq", val }); return this; }
  in(col: string, val: unknown[]) { this.filters.push({ col, op: "in", val }); return this; }
  gt(col: string, val: unknown) { this.filters.push({ col, op: "gt", val }); return this; }
  lt(col: string, val: unknown) { this.filters.push({ col, op: "lt", val }); return this; }
  gte(col: string, val: unknown) { this.filters.push({ col, op: "gte", val }); return this; }
  lte(col: string, val: unknown) { this.filters.push({ col, op: "lte", val }); return this; }
  is(col: string, val: unknown) { this.filters.push({ col, op: "is", val }); return this; }
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending ?? true, nullsFirst: opts?.nullsFirst });
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }
  single() { this.singleRow = true; return this; }
  maybeSingle() { this.singleRow = true; return this; }

  private whereSql(params: unknown[]): string {
    if (this.filters.length === 0) return "";
    const clauses = this.filters.map((f) => {
      if (f.op === "in") {
        params.push(f.val);
        return `${q(f.col)} = ANY($${params.length})`;
      }
      if (f.op === "is") {
        return `${q(f.col)} is ${f.val === null ? "null" : f.val ? "true" : "false"}`;
      }
      const opSql = { eq: "=", neq: "<>", gt: ">", lt: "<", gte: ">=", lte: "<=" }[f.op];
      params.push(f.val);
      return `${q(f.col)} ${opSql} $${params.length}`;
    });
    return " where " + clauses.join(" and ");
  }

  private async exec(): Promise<Result> {
    const { db, meta } = await getDb();
    const params: unknown[] = [];
    let sql = "";

    // rpc(): call a Postgres function. Scalar/void funcs return their value;
    // set/table-returning funcs return rows (filterable / single()).
    if (this.rpcSpec) {
      const keys = Object.keys(this.rpcSpec.params);
      const values = keys.map((k) => this.rpcSpec!.params[k]);
      const argSql = keys.map((k, i) => `${q(k)} => $${i + 1}`).join(", ");
      try {
        const res = await db.query<{ result: unknown }>(
          `select ${q(this.rpcSpec.fn)}(${argSql}) as result`,
          values
        );
        return { data: res.rows[0]?.result ?? null, error: null };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/set-returning|must appear in the FROM/i.test(msg)) {
          try {
            const p2 = [...values];
            let s2 = `select * from ${q(this.rpcSpec.fn)}(${argSql})`;
            s2 += this.whereSql(p2);
            if (this.singleRow) s2 += " limit 1";
            const res = await db.query<Record<string, unknown>>(s2, p2);
            const rows = res.rows ?? [];
            return { data: this.singleRow ? rows[0] ?? null : rows, error: null };
          } catch (e2) {
            return { data: null, error: { message: e2 instanceof Error ? e2.message : String(e2) } };
          }
        }
        return { data: null, error: { message: msg } };
      }
    }

    if (this.op === "select") {
      const fields = parseFields(this.selectStr);
      sql = `select ${buildFields(meta, this.table, fields)} from ${q(this.table)}`;
      sql += this.whereSql(params);
      if (this.orders.length) {
        sql +=
          " order by " +
          this.orders
            .map(
              (o) =>
                `${q(o.col)} ${o.asc ? "asc" : "desc"}` +
                (o.nullsFirst === undefined ? "" : o.nullsFirst ? " nulls first" : " nulls last")
            )
            .join(", ");
      }
      if (this.limitN != null) sql += ` limit ${this.limitN}`;
      if (this.singleRow) sql += " limit 1";
    } else if (this.op === "insert") {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload!];
      if (rows.length === 0) return { data: this.singleRow ? null : [], error: null };
      const cols = Object.keys(rows[0]);
      const valuesSql = rows
        .map(
          (r) =>
            "(" +
            cols
              .map((c) => {
                params.push((r as Record<string, unknown>)[c]);
                return `$${params.length}`;
              })
              .join(", ") +
            ")"
        )
        .join(", ");
      sql = `insert into ${q(this.table)} (${cols.map(q).join(", ")}) values ${valuesSql}`;
      if (this.conflictTarget !== undefined || this.ignoreDup) {
        const target = this.conflictTarget
          ? `(${this.conflictTarget.split(",").map((c) => q(c.trim())).join(", ")})`
          : "";
        sql += ` on conflict ${target} do nothing`;
      }
      if (this.returning) sql += ` returning ${this.selectStr === "*" ? "*" : this.selectStr}`;
    } else if (this.op === "update") {
      const cols = Object.keys(this.updateVals!);
      const setSql = cols
        .map((c) => {
          params.push(this.updateVals![c]);
          return `${q(c)} = $${params.length}`;
        })
        .join(", ");
      sql = `update ${q(this.table)} set ${setSql}`;
      sql += this.whereSql(params);
      if (this.returning) sql += ` returning ${this.selectStr === "*" ? "*" : this.selectStr}`;
    } else {
      sql = `delete from ${q(this.table)}`;
      sql += this.whereSql(params);
      if (this.returning) sql += ` returning ${this.selectStr === "*" ? "*" : this.selectStr}`;
    }

    try {
      const res = await db.query<Record<string, unknown>>(sql, params);
      const rows = res.rows ?? [];
      const count = this.wantCount ? res.affectedRows ?? rows.length : undefined;
      if (this.singleRow) {
        return { data: rows[0] ?? null, error: null, count };
      }
      if (this.op !== "select" && !this.returning) {
        return { data: null, error: null, count };
      }
      return { data: rows, error: null, count };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { data: null, error: { message } };
    }
  }

  // Typed so `await`/destructuring stays loose (like supabase-js): the fulfilled
  // value is `any`, so `const { data, error } = await query` gives `any` data.
  then(
    onF?: ((v: any) => any) | null,
    onR?: ((r: any) => any) | null
  ): Promise<any> {
    return this.exec().then(onF ?? undefined, onR ?? undefined);
  }
}

export class PgRestClient {
  from(table: string) {
    return new Query(table);
  }

  /** Call a Postgres function. Returns a chainable/awaitable builder so
   *  `.single()`, filters, etc. work like supabase-js. */
  rpc(fn: string, params: Record<string, unknown> = {}) {
    return new Query(fn)._asRpc(fn, params);
  }
}

export function createPgRestClient() {
  return new PgRestClient();
}
