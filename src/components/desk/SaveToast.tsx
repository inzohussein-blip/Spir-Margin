"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

/**
 * Confirms a save after a server action redirects.
 *
 * The write actions finish with `redirect("/labs?saved=created")`, so by the
 * time the browser lands there the action is gone and nothing on the page
 * knows a save happened. This reads the marker, raises the toast, then strips
 * the parameter with `replace` so a refresh or a shared link does not
 * re-announce a save that already happened.
 */
const MESSAGES: Record<string, string> = {
  created: "Saved successfully",
  updated: "Changes saved",
  deleted: "Deleted successfully",
};

export function SaveToast() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const shown = useRef<string | null>(null);

  const saved = params.get("saved");

  useEffect(() => {
    if (!saved) return;
    // Guard against React's double-invoke in development and against the
    // effect re-firing on an unrelated re-render.
    const token = `${pathname}:${saved}`;
    if (shown.current === token) return;
    shown.current = token;

    toast.success(t(locale, MESSAGES[saved] ?? "Saved successfully"));

    const next = new URLSearchParams(params.toString());
    next.delete("saved");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [saved, pathname, params, router, locale]);

  return null;
}
