import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * Which numbered release this copy is: `version.json` at the program's root,
 * {"number": N, "commit": "…", "date": "YYYY-MM-DD"} — written into the
 * release package by the (now archived) Windows release pipeline. The web
 * version has none (null); installed copies report it with each license check
 * so the code manager can tell who runs an old version.
 */
export interface Build { number: number; commit: string | null; date: string | null }

export function currentBuild(): Build | null {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "version.json"), "utf8").replace(/^﻿/, "");
    const v = JSON.parse(raw) as Record<string, unknown>;
    const number = Number(v.number);
    if (!Number.isInteger(number) || number <= 0) return null;
    return { number, commit: typeof v.commit === "string" ? v.commit : null, date: typeof v.date === "string" ? v.date : null };
  } catch {
    return null;
  }
}
