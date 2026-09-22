import type { MetadataRoute } from "next";

/**
 * PWA manifest — what the operating system uses once the app is installed
 * from Settings: the name in the Start menu and the install dialog, the
 * window, the taskbar icon.
 *
 * Arabic, like the rest of the app. PNG icons because Windows builds its
 * Start-menu and taskbar icons from them (an SVG alone gives a blurry or
 * generic one); `scripts/render-icons.mjs` regenerates them from icon.svg.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Spir-Margin — إدارة الأجهزة الطبية والمختبرات",
    short_name: "Spir-Margin",
    description: "مبيعات الأجهزة الطبية، ومتابعة المختبرات، ونقطة البيع، والحسابات المصرفية — يعمل على هذا الحاسوب بلا إنترنت.",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f5f8",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
