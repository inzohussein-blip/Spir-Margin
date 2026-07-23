/**
 * A tiny, dependency-free offline outbox.
 *
 * When the network is down (or a submit fails mid-flight), the core sales flow
 * queues the operation here — in localStorage, so it survives reloads and the
 * connection dropping — and it is replayed when connectivity returns. Each item
 * carries a client-generated UUID that doubles as the server idempotency key,
 * so replaying a queued sale can never double-post it.
 */

export interface PosSaleLine {
  product_id: string;
  qty: number;
  sell_price: number;
  /** Display only. */
  name?: string;
}

export interface PosSalePayload {
  labId: string;
  labName?: string;
  lines: PosSaleLine[];
}

export interface OutboxItem {
  id: string; // UUID — also the server idempotency key
  type: "pos_sale";
  payload: PosSalePayload;
  createdAt: number;
  lastError?: string;
}

const KEY = "spir_outbox_v1";
const EVENT = "spir-outbox-change";

export function getOutbox(): OutboxItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

export function setOutbox(items: OutboxItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Add an item (idempotent on id, so the same op is never queued twice). */
export function enqueue(item: OutboxItem): void {
  const items = getOutbox();
  if (items.some((i) => i.id === item.id)) return;
  setOutbox([...items, item]);
}

export function removeItem(id: string): void {
  setOutbox(getOutbox().filter((i) => i.id !== id));
}

/** Subscribe to queue changes (in this tab and across tabs). */
export function subscribeOutbox(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
