import {
  servePull, serveAccept, serveMeta, serveSnapshot, nodeId, BATCH,
  type Db, type ChangeRow, type SyncPeer, type PullPage, type SnapshotMeta, type SnapshotPage,
} from "../sync/core";

/**
 * Cloud sync: how the web version's local app (Postgres in the browser)
 * syncs with its company's hosted database, through the site — never with
 * the database's address or password in the browser.
 *
 * The site answers the same four moves a hosted database answers a computer
 * (sync/core.ts: pull, push, meta, snapshot), on the database the company's
 * activation code carries. This file is both ends of the wire, with no
 * framework: `serveCloud` runs on the site on that database, `cloudPeer` is
 * the browser's SyncPeer that posts to it. The route (/api/cloud) adds who
 * may ask: a genuine license for that code and that browser.
 */

export type CloudOp = "hello" | "pull" | "push" | "meta" | "snap";
export interface CloudRequest {
  op: CloudOp;
  /** The caller's node id (its own database's). */
  node: string;
  after?: string;
  rows?: ChangeRow[];
  table?: string;
  cursor?: string | null;
}
export const MAX_PUSH = 500;

/** The site's side, on the company's database. Throws on a bad request. */
export async function serveCloud(db: Db, req: CloudRequest): Promise<unknown> {
  const node = String(req.node ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(node)) throw new Error("bad_request");
  const tag = `n:${node}`;
  switch (req.op) {
    case "hello":
      return { node: await nodeId(db), meta: await serveMeta(db) };
    case "pull":
      return servePull(db, String(req.after ?? "0"), node, tag, BATCH);
    case "push": {
      const rows = Array.isArray(req.rows) ? req.rows : [];
      if (rows.length > MAX_PUSH) throw new Error("bad_request");
      return serveAccept(db, rows, tag);
    }
    case "meta":
      return serveMeta(db);
    case "snap":
      if (typeof req.table !== "string") throw new Error("bad_request");
      return serveSnapshot(db, req.table, req.cursor ?? null);
    default:
      throw new Error("bad_request");
  }
}

/** The browser's side: a SyncPeer that asks the site. `post` sends one request and returns its JSON. */
export function cloudPeer(post: (req: CloudRequest) => Promise<unknown>, me: string): SyncPeer {
  return {
    key: "cloud",
    pull: (after) => post({ op: "pull", node: me, after }) as Promise<PullPage>,
    push: (rows) => post({ op: "push", node: me, rows }) as Promise<(string | null)[]>,
    meta: () => post({ op: "meta", node: me }) as Promise<SnapshotMeta>,
    snapshot: (table, after) => post({ op: "snap", node: me, table, cursor: after }) as Promise<SnapshotPage>,
  };
}
