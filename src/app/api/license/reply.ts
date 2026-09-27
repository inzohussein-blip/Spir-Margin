import "server-only";
import { NextResponse } from "next/server";
import type { DeviceResult } from "@/lib/license/core";

/** A computer's answer: its signed license (with its company's database link), or why not. */
export function deviceReply(r: DeviceResult, opts?: { browser?: boolean }) {
  // A browser (the web version's local app) never receives the company
  // database's address: it syncs through the site (/api/cloud). It is only
  // told whether there is one.
  const body = r.ok
    ? {
        ok: true, token: r.token, pub: r.pub, now: Date.now(), message: r.row.message || "",
        sync: opts?.browser ? null : r.sync, cloud: !!r.sync, vkey: r.vkey,
        company: r.row.company, until: r.row.expires_at, mods: r.row.modules,
      }
    : { ok: false, error: r.error, company: r.row?.company, until: r.row?.expires_at ?? null, now: Date.now() };
  const status = r.ok ? 200 : r.error === "not_found" ? 404 : 403;
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}
