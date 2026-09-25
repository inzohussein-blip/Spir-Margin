"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { recall, remember } from "@/lib/remember";

/**
 * A list's last search comes back when the person returns to it.
 *
 * Arriving with no `q` at all (from the menu, a link, the back button)
 * brings the saved search back. Any `q` in the address — including an
 * empty one, which is what «Clear» and an empty search send — is taken as
 * the person's choice, and remembered.
 */
export function RememberSearch({ basePath }: { basePath: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const hasQ = params.has("q");
  const q = params.get("q") ?? "";
  useEffect(() => {
    const key = `list.q:${basePath}`;
    if (pathname !== basePath) return;
    if (hasQ) {
      remember(key, q.trim() || null);
      return;
    }
    const saved = recall(key);
    if (saved) router.replace(`${basePath}?q=${encodeURIComponent(saved)}`);
    // Once per arrival and per search: the router is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasQ, q, basePath, pathname]);
  return null;
}
