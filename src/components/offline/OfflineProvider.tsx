"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createPosSale } from "@/app/actions/pos";
import {
  enqueue, getOutbox, setOutbox, subscribeOutbox,
  type OutboxItem, type PosSalePayload,
} from "@/lib/offline/outbox";

export type SubmitResult =
  | { status: "synced"; count: number; total: number }
  | { status: "queued" }
  | { status: "error"; error: string };

interface OfflineContextValue {
  online: boolean;
  pending: OutboxItem[];
  syncing: boolean;
  /** Submit a POS sale — sent now when online, queued (and auto-synced) when not. */
  submitSale: (payload: PosSalePayload) => Promise<SubmitResult>;
  /** Manually flush the outbox now (the "Sync" button). */
  flush: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState<OutboxItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const flushing = useRef(false);

  const refresh = useCallback(() => setPending(getOutbox()), []);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const items = getOutbox();
    if (items.length === 0) return;

    flushing.current = true;
    setSyncing(true);
    let synced = 0;
    let networkDown = false;
    const keep: OutboxItem[] = [];
    try {
      for (const item of items) {
        if (networkDown) { keep.push(item); continue; }
        if (item.type !== "pos_sale") { keep.push(item); continue; }
        try {
          const res = await createPosSale(item.payload.labId, item.payload.lines, item.id);
          if (res.ok) {
            synced += 1; // booked (idempotent, so a lost-response retry is safe)
          } else {
            // Server was reached but rejected it (e.g. a product was disabled
            // meanwhile). Keep it so the sale is never silently lost, but record
            // why so the operator can see it.
            keep.push({ ...item, lastError: res.error });
          }
        } catch {
          // Network error — stop here and keep this item and the rest for later.
          networkDown = true;
          keep.push(item);
        }
      }
    } finally {
      setOutbox(keep);
      setPending(keep);
      setSyncing(false);
      flushing.current = false;
      if (synced > 0) router.refresh(); // pull the freshly-synced data into the UI
    }
  }, [router]);

  const submitSale = useCallback(async (payload: PosSalePayload): Promise<SubmitResult> => {
    const id = newId();
    const item: OutboxItem = { id, type: "pos_sale", payload, createdAt: Date.now() };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueue(item);
      refresh();
      return { status: "queued" };
    }
    try {
      const res = await createPosSale(payload.labId, payload.lines, id);
      if (res.ok) return { status: "synced", count: res.count, total: res.total };
      return { status: "error", error: res.error };
    } catch {
      // The request may or may not have reached the server — queue it under the
      // same id, so the replay is idempotent either way.
      enqueue(item);
      refresh();
      return { status: "queued" };
    }
  }, [refresh]);

  useEffect(() => {
    setOnline(navigator.onLine);
    refresh();
    const goOnline = () => { setOnline(true); void flush(); };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const unsub = subscribeOutbox(refresh);
    // Attempt a sync on first mount if we're online with a non-empty queue.
    if (navigator.onLine) void flush();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      unsub();
    };
  }, [refresh, flush]);

  return (
    <OfflineContext.Provider value={{ online, pending, syncing, submitSale, flush }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline(): OfflineContextValue {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used within OfflineProvider");
  return ctx;
}
