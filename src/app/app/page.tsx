import { LocalApp } from "@/components/local/LocalApp";

/**
 * The web version as an app (src/components/local): the whole program runs in
 * the browser on its own database, so this page holds nothing from the server
 * and is the same for everyone — the offline worker keeps it to open without
 * the internet.
 */
export default function AppPage() {
  return <LocalApp />;
}
