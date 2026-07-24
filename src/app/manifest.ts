import type { MetadataRoute } from "next";

/** PWA manifest — makes Spir-Margin installable (add to home screen) as a
 *  standalone app, useful for the point-of-sale / field workflow. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Spir-Margin — Medical Device & Lab Management",
    short_name: "Spir-Margin",
    description: "Medical-device sales, lab tracking, point of sale and banking.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f8",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
