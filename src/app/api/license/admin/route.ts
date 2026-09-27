import { NextResponse, type NextRequest } from "next/server";
import {
  codesDb, codesServerEnabled, ownerPasswordSet, durableStorage, storageStatus, getContact, setContact,
  twoFactorStatus, twoFactorRequired, checkOwnerCode, startTwoFactorSetup, confirmTwoFactor, disableTwoFactor,
} from "@/lib/license/server";
import type { LicenseAction } from "@/lib/license/core";
import { passwordMatches, startOwnerSession, endOwnerSession, isOwner, ipOf } from "@/lib/license/owner";
import { isTransactionPooler } from "@/lib/db/pglite";
import { databaseHost, probeDatabase } from "@/lib/db/probe";
import { currentBuild } from "@/lib/update/updates";

/** The owner's endpoints for the code manager (/licenses). */
export const dynamic = "force-dynamic";
const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { "cache-control": "no-store" } });

export async function GET() {
  if (!codesServerEnabled()) return json({ enabled: false, owner: false, needsDb: ownerPasswordSet() && !durableStorage() });
  if (!(await isOwner())) return json({ enabled: true, owner: false });
  const storage = await storageStatus();
  if (!storage.ok) return json({ enabled: true, owner: true, storage, licenses: [], events: [], contact: "", now: Date.now() });
  const { licenses } = await codesDb();
  return json({
    enabled: true, owner: true, storage,
    licenses: await licenses.list(), events: await licenses.events(), signIns: await licenses.signIns(),
    actions: await licenses.actions(), plan: await licenses.plan(), prefs: await licenses.prefs(), errors: await licenses.errors(),
    twoFactor: await twoFactorStatus(), contact: await getContact(), version: currentBuild()?.number ?? null, now: Date.now(),
  });
}

export async function POST(req: NextRequest) {
  if (!codesServerEnabled()) return json({ ok: false, error: "disabled" }, 400);
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { /* empty */ }
  const { licenses } = await codesDb();

  if (b.op === "login") {
    const ip = ipOf(req.headers);
    const agent = req.headers.get("user-agent") ?? "";
    if (await licenses.blocked("owner", ip, 8)) { await licenses.logSignIn(false, ip, agent); return json({ ok: false, error: "too_many" }, 429); }
    if (!passwordMatches(String(b.password ?? ""))) {
      await licenses.noteAttempt("owner", ip);
      await licenses.logSignIn(false, ip, agent);
      await new Promise((r) => setTimeout(r, 500));
      return json({ ok: false, error: "wrong" }, 401);
    }
    // With the authenticator set up, the password alone asks for its code.
    if (await twoFactorRequired()) {
      const code = String(b.code ?? "").trim();
      if (!code) return json({ ok: false, error: "need_code" }, 401);
      if (!(await checkOwnerCode(code))) {
        await licenses.noteAttempt("owner", ip);
        await licenses.logSignIn(false, ip, agent);
        await new Promise((r) => setTimeout(r, 500));
        return json({ ok: false, error: "wrong_code" }, 401);
      }
    }
    await licenses.clearAttempts("owner", ip);
    await licenses.logSignIn(true, ip, agent);
    await startOwnerSession();
    return json({ ok: true });
  }
  if (b.op === "logout") { await endOwnerSession(); return json({ ok: true }); }

  if (!(await isOwner())) return json({ ok: false, error: "auth" }, 401);

  // Every change the owner makes is kept with the address it came from (never a code or a password).
  const ip = ipOf(req.headers), agent = req.headers.get("user-agent") ?? "";
  const note = (action: string, license_id = "", company = "", detail = "") => licenses.logAction({ ip, agent, license_id, company, action, detail });
  const nameOf = async (id: string) => (id ? (await licenses.get(id))?.company ?? "" : "");

  if (b.op === "create") {
    const company = String(b.company ?? "").trim();
    const days = Number(b.days), seats = Number(b.seats);
    if (!company || !Number.isFinite(days) || days < 1 || !Number.isFinite(seats) || seats < 1) return json({ ok: false, error: "bad_request" }, 400);
    const { row, code } = await licenses.create({
      company, days, seats, modules: b.modules, note: String(b.note ?? ""), trial: b.trial === true,
      phone: String(b.phone ?? ""), maxOfflineDays: Number(b.maxOfflineDays ?? 0), price: String(b.price ?? ""),
    });
    await note(row.is_trial ? "create_trial" : "create", row.id, row.company, `${row.duration_days}d · ${row.seats}`);
    return json({ ok: true, row, code });
  }
  if (b.op === "update") {
    const id = String(b.id ?? "");
    const change = (b.change ?? {}) as LicenseAction;
    const company = await nameOf(id);
    const res = await licenses.update(id, change);
    const c = change as Record<string, unknown>;
    const detail = c.action === "extend" ? `+${c.days}` : c.action === "seats" ? String(c.seats) : c.action === "offline" ? String(c.days)
      : c.action === "payment" ? `${c.paid ? "paid" : "unpaid"} ${String(c.price ?? "")}` : c.action === "modules" && Array.isArray(c.modules) ? c.modules.join(",") : "";
    await note(String(c.action ?? "update"), id, res.row?.company ?? company, detail);
    return json({ ok: true, ...res });
  }
  if (b.op === "backup") { await note("backup"); return json({ ok: true, backup: await licenses.exportAll() }); }
  if (b.op === "restore") {
    try {
      const r = await licenses.importAll(b.backup);
      await note("restore", "", "", `${r.licenses}`);
      return json({ ok: true, ...r });
    } catch { return json({ ok: false, error: "invalid" }, 400); }
  }
  if (b.op === "plan") {
    const plan = await licenses.setPlan(b.plan);
    await note("plan");
    return json({ ok: true, plan });
  }
  if (b.op === "prefs") {
    const prefs = await licenses.setPrefs(b.prefs);
    await note("prefs");
    return json({ ok: true, prefs });
  }
  if (b.op === "errors_clear") { await licenses.clearErrors(); await note("errors_clear"); return json({ ok: true }); }
  if (b.op === "selftest") return json({ ok: true, storage: await storageStatus(true) });
  if (b.op === "totp_setup") {
    const r = await startTwoFactorSetup();
    if (!r) return json({ ok: false, error: "no_secret" }, 400);
    const QRCode = (await import("qrcode")).default;
    return json({ ok: true, secret: r.secret, qr: await QRCode.toDataURL(r.uri, { margin: 1, width: 220, errorCorrectionLevel: "M" }) });
  }
  if (b.op === "totp_enable") {
    if (!(await confirmTwoFactor(String(b.code ?? "")))) return json({ ok: false, error: "wrong_code" }, 400);
    await note("totp_on");
    return json({ ok: true });
  }
  if (b.op === "totp_disable") {
    if (!(await disableTwoFactor(String(b.code ?? "")))) return json({ ok: false, error: "wrong_code" }, 400);
    await note("totp_off");
    return json({ ok: true });
  }
  if (b.op === "contact") { await setContact(String(b.contact ?? "")); await note("contact"); return json({ ok: true }); }

  // A company's own database, carried by its code: see (never the password), test, link, copy, unlink.
  if (b.op === "sync_get") {
    const s = await licenses.getSync(String(b.id ?? ""));
    return json({ ok: true, config: s ? { host: databaseHost(s.conn), by: s.by } : null });
  }
  if (b.op === "sync_copy") {
    const from = await licenses.getSync(String(b.from ?? ""));
    if (!from) return json({ ok: false, error: "bad_config" }, 400);
    const err = await licenses.setSync(String(b.id ?? ""), from.conn, databaseHost(from.conn), "owner");
    if (!err) await note("sync", String(b.id ?? ""), await nameOf(String(b.id ?? "")), databaseHost(from.conn));
    return err ? json({ ok: false, error: err }, 400) : json({ ok: true });
  }
  if (b.op === "sync_set" || b.op === "sync_test") {
    const id = String(b.id ?? "");
    if (b.op === "sync_set" && b.conn == null) {
      const err = await licenses.setSync(id, null, "", "owner");
      if (!err) await note("unsync", id, await nameOf(id));
      return err ? json({ ok: false, error: err }, 400) : json({ ok: true });
    }
    // Left empty in the form: keep what is saved (the owner never sees it again).
    const conn = String(b.conn ?? "").trim() || (id ? (await licenses.getSync(id))?.conn ?? "" : "");
    if (!/^postgres(ql)?:\/\/\S+$/i.test(conn) || conn.length > 1000) return json({ ok: false, error: "bad_config" }, 400);
    if (isTransactionPooler(conn)) return json({ ok: false, error: "pooler" }, 400);
    const failure = await probeDatabase(conn);
    if (failure) return json({ ok: false, error: "connect", detail: failure.slice(0, 200) }, 502);
    if (b.op === "sync_test") return json({ ok: true, host: databaseHost(conn) });
    const err = await licenses.setSync(id, conn, databaseHost(conn), "owner");
    if (!err) await note("sync", id, await nameOf(id), databaseHost(conn));
    return err ? json({ ok: false, error: err }, 400) : json({ ok: true, host: databaseHost(conn) });
  }
  return json({ ok: false, error: "bad_request" }, 400);
}
