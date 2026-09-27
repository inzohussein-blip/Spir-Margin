"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { runtime, type LocalRuntime } from "@/lib/local/runtime";
import type { PgRestClient } from "@/lib/db/rest-core";

/** The runtime, re-rendering on the events named. */
export function useRuntime(events: string[] = ["phase", "sync", "user", "license", "change"]): LocalRuntime {
  const rt = runtime();
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    for (const e of events) rt.addEventListener(e, bump);
    return () => { for (const e of events) rt.removeEventListener(e, bump); };
  }, [rt, events.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  return rt;
}

/** The part of the address after #: "/labs?q=x" → { path: "/labs", params }. */
export function useRoute(): { path: string; params: URLSearchParams; go: (to: string) => void } {
  const read = () => {
    const h = typeof window === "undefined" ? "" : window.location.hash.replace(/^#/, "") || "/";
    const [path, query = ""] = h.split("?");
    return { path: path || "/", params: new URLSearchParams(query) };
  };
  const [r, setR] = useState(read);
  useEffect(() => {
    const on = () => setR(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = useCallback((to: string) => { window.location.hash = to; }, []);
  return { ...r, go };
}

type Res = { data: any; error: { message: string } | null; count?: number }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** A query on the local database, run again whenever its data changes. */
export function useLocalQuery<T>(run: (c: PgRestClient) => PromiseLike<Res>, deps: unknown[]): { data: T | null; count: number; error: string | null; loading: boolean } {
  const rt = runtime();
  const [tick, bump] = useReducer((x: number) => x + 1, 0);
  const [s, setS] = useState<{ data: T | null; count: number; error: string | null; loading: boolean }>({ data: null, count: 0, error: null, loading: true });
  useEffect(() => {
    rt.addEventListener("change", bump);
    return () => rt.removeEventListener("change", bump);
  }, [rt]);
  useEffect(() => {
    let live = true;
    if (!rt.client) return;
    Promise.resolve(run(rt.client)).then((r) => {
      if (live) setS({ data: (r.data as T) ?? null, count: r.count ?? 0, error: r.error?.message ?? null, loading: false });
    });
    return () => { live = false; };
  }, [tick, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return s;
}
