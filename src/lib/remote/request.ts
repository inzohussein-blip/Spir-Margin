import "server-only";
import { headers } from "next/headers";

/**
 * Did this request come through the remote-access gateway, from another
 * device? The gateway drops any `x-spir-*` header a browser sends and sets
 * its own, and the program itself listens on 127.0.0.1 only, so the mark
 * cannot be removed from outside — only added, which only restricts.
 */
export function isRemoteRequest(): boolean {
  try {
    return headers().get("x-spir-remote") === "1";
  } catch {
    return false; // outside a request (background work)
  }
}

/**
 * Cookies marked Secure are dropped by browsers on plain http from another
 * address; over the gateway (http, inside the office network or a private
 * network such as Tailscale) they must not be.
 */
export function secureCookies(): boolean {
  return process.env.NODE_ENV === "production" && !isRemoteRequest();
}
