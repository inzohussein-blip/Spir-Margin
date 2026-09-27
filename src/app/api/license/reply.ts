import "server-only";
import { NextResponse } from "next/server";
import type { DeviceResult } from "@/lib/license/core";

/** A computer's answer: its signed license (with its company's database link), or why not. */
export function deviceReply(r: DeviceResult) {
  const body = r.ok
    ? { ok: true, token: r.token, pub: r.pub, now: Date.now(), message: r.row.message || "", sync: r.sync, vkey: r.vkey }
    : { ok: false, error: r.error, company: r.row?.company, until: r.row?.expires_at ?? null, now: Date.now() };
  const status = r.ok ? 200 : r.error === "not_found" ? 404 : 403;
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}
