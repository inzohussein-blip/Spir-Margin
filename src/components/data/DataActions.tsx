"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SubmitResult } from "@/components/offline/OfflineProvider";
import type { PosSalePayload } from "@/lib/offline/outbox";
import type { KitHint } from "@/lib/kits";

/**
 * Where a shared screen sends its work. On an installed computer (and the
 * server-rendered pages) nothing is provided: screens use the server actions
 * as always. The web version's local app provides its own — the same work on
 * the Postgres inside the browser — so one PosTerminal serves both.
 */
export interface DataActions {
  submitSale?: (p: PosSalePayload) => Promise<SubmitResult>;
  kitHints?: () => Promise<Record<string, KitHint>>;
  /** Where "back" leads from a full-screen tool (the POS). */
  homeHref?: string;
  /** Replaces the server's connection and outbox chip. */
  statusSlot?: ReactNode;
}

const Ctx = createContext<DataActions>({});
export const DataActionsProvider = ({ value, children }: { value: DataActions; children: ReactNode }) => (
  <Ctx.Provider value={value}>{children}</Ctx.Provider>
);
export const useDataActions = () => useContext(Ctx);
