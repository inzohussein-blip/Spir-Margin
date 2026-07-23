"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * A lightweight top progress bar that gives instant feedback when the user
 * starts navigating — the app's pages are server-rendered, so without this the
 * click-to-paint gap feels "heavy". It:
 *   - starts (and animates toward ~90%) the moment an internal link is clicked,
 *   - completes and fades out once the pathname / query actually changes.
 *
 * No dependencies, no layout impact (a single fixed 2.5px bar), and it ignores
 * modified clicks, new-tab links, downloads, external URLs and hash jumps.
 */
export function NavProgress() {
  const pathname = usePathname();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failsafe = useRef<ReturnType<typeof setTimeout> | null>(null);

  function bar(): HTMLElement | null {
    return document.getElementById("nav-progress");
  }

  function start() {
    const el = bar();
    if (!el) return;
    if (timer.current) clearInterval(timer.current);
    if (doneTimer.current) clearTimeout(doneTimer.current);
    if (failsafe.current) clearTimeout(failsafe.current);
    // Never let the bar hang if a navigation is cancelled or blocked client-side.
    failsafe.current = setTimeout(() => finish(), 10000);
    el.classList.remove("done");
    el.classList.add("active");
    let width = 8;
    el.style.width = width + "%";
    // Ease toward 90% and hold; the pathname effect finishes it to 100%.
    timer.current = setInterval(() => {
      width += Math.max(0.4, (90 - width) * 0.12);
      if (width >= 90) width = 90;
      el.style.width = width + "%";
    }, 120);
  }

  function finish() {
    const el = bar();
    if (!el) return;
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    if (failsafe.current) { clearTimeout(failsafe.current); failsafe.current = null; }
    el.style.width = "100%";
    el.classList.add("done");
    doneTimer.current = setTimeout(() => {
      el.classList.remove("active", "done");
      el.style.width = "0%";
    }, 260);
  }

  // Complete the bar whenever the route settles on a new pathname.
  useEffect(() => {
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Start the bar on a genuine internal link click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || a.target === "_blank" || a.hasAttribute("download")) return;
      // Same-origin, different path only.
      let url: URL;
      try { url = new URL(href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      if (timer.current) clearInterval(timer.current);
      if (doneTimer.current) clearTimeout(doneTimer.current);
      if (failsafe.current) clearTimeout(failsafe.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div id="nav-progress" aria-hidden />;
}
