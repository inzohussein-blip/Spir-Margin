// Writes docs/FILES.md: every source file of the project, one line each —
// what it is (its own header comment, first sentence), what it exports, and
// for a page its address and menu name. docs/MAP.md is the hand-written guide
// (feature → files, how the data moves); this is the index to look a file up.
//
//   node scripts/map.mjs          rewrite docs/FILES.md   (npm run map)
//   node scripts/map.mjs --check  exit 1 when a file was added or removed
//                                 since it was written (tests/map.test.mjs)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs/FILES.md");

// What is mapped, and what is not: generated or copied files, pictures, and
// the closed Windows version (windows-archive/README.md lists its files).
const ROOTS = ["src", "scripts", "tests", "public", "supabase", ".github/workflows"];
const SKIP = [/^public\/(pglite|spir)\//, /^tests\/browser\/artifacts\//, /\.(png|jpe?g|svg|ico|webp|gif|woff2?)$/, /^src\/lib\/database\.types\.ts$/];
const TEXT = /\.(tsx?|mjs|js|cjs|sql|md|html|json|txt|yml|css|sh)$/;

function walk(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  // A folder's own files first, then its sub-folders, each by name.
  return fs.readdirSync(abs, { withFileTypes: true })
    .sort((a, b) => Number(a.isDirectory()) - Number(b.isDirectory()) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .flatMap((e) => {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) return e.name === "node_modules" ? [] : walk(rel);
      return TEXT.test(e.name) && !SKIP.some((re) => re.test(rel)) ? [rel] : [];
    });
}

export function files() {
  return ROOTS.flatMap(walk);
}

// ------------------------------------------------------------ descriptions
const clip = (s, n = 190) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** The first sentence of a comment's text. */
function sentence(text) {
  const flat = text.replace(/\s+/g, " ").trim();
  const m = flat.match(/^(.+?[.!?])(\s|$)/);
  return clip((m ? m[1] : flat).replace(/[.:]$/, ""));
}

/** The file's own header: a comment before any code, else the first top-level doc comment. */
function header(src) {
  const lines = src.replace(/^﻿/, "").split("\n");
  let i = 0;
  const skip = (l) => /^\s*$/.test(l) || /^\s*["']use (client|server|strict)["'];?\s*$/.test(l) || /^\s*import\b/.test(l) || /^\s*(from\s|\}\s*from\s|[\w{},\s*]+\bfrom\s)/.test(l) || /^#!/.test(l) || /^\s*export\s+(const\s+)?(dynamic|runtime|revalidate|maxDuration)\b/.test(l);
  // Leading comment (imports and directives may come first).
  while (i < lines.length && skip(lines[i]) && !/^\s*(\/\/|\/\*)/.test(lines[i])) i++;
  const block = readComment(lines, i);
  if (block) return block;
  for (let j = 0; j < lines.length; j++) if (/^\/\*\*/.test(lines[j])) return readComment(lines, j);
  return "";
}

function readComment(lines, i) {
  const l = lines[i] ?? "";
  if (/^\s*\/\//.test(l)) {
    const out = [];
    for (; i < lines.length && /^\s*\/\//.test(lines[i]); i++) {
      const t = lines[i].replace(/^\s*\/\/+\s?/, "");
      if (/^[-=─]{4,}/.test(t.trim())) { if (out.length) break; continue; }
      if (!t.trim() && out.length) break;
      out.push(t);
    }
    return out.join(" ").trim();
  }
  if (/^\s*\/\*/.test(l)) {
    const out = [];
    for (; i < lines.length; i++) {
      const end = lines[i].includes("*/");
      const t = lines[i].replace(/^\s*\/\*+\s?/, "").replace(/\*\/.*$/, "").replace(/^\s*\*\s?/, "");
      if (/^[-=─]{4,}/.test(t.trim())) { if (end) break; continue; }
      if (!t.trim() && out.length) break;
      out.push(t);
      if (end) break;
    }
    return out.join(" ").trim();
  }
  return "";
}

function sqlHeader(src) {
  const lines = src.split("\n").filter((l) => /^--/.test(l)).map((l) => l.replace(/^--+\s?/, ""));
  const title = lines.find((l) => /^Migration\s+\d+\s*:/.test(l));
  if (title) return clip(title.replace(/^Migration\s+\d+\s*:\s*/, "").trim());
  const first = lines.find((l) => l.trim() && !/^[-=]{4,}/.test(l.trim()));
  return first ? sentence(first) : "";
}

const exportsOf = (src) => [...new Set([...src.matchAll(/^export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|class|interface|type|enum|abstract class)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]))];

// Menu names, from the sidebar's own source (href → label).
const NAV = new Map([...fs.readFileSync(path.join(ROOT, "src/lib/nav.ts"), "utf8").matchAll(/href:\s*"([^"]+)",\s*label:\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]));

function route(rel) {
  const p = rel.replace(/^src\/app/, "").replace(/\/(page|route|layout|loading|error|not-found)\.tsx?$/, "").replace(/\/\([^)]+\)/g, "");
  return p || "/";
}

function describe(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const ext = path.extname(rel);
  if (ext === ".sql") return sqlHeader(src);
  if (ext === ".md") return clip((src.match(/^#\s+(.+)$/m)?.[1] ?? "").trim());
  if (ext === ".json" || ext === ".txt" || ext === ".css" || ext === ".html") {
    return ext === ".html" ? clip(src.match(/<title>([^<]*)<\/title>/)?.[1] ?? "") : "";
  }
  if (ext === ".yml") return sentence(src.split("\n").filter((l) => /^#/.test(l)).map((l) => l.replace(/^#\s?/, "")).join(" ") || (src.match(/^name:\s*(.+)$/m)?.[1] ?? ""));
  if (ext === ".sh") return sentence(src.split("\n").filter((l) => /^#[^!]/.test(l)).map((l) => l.replace(/^#\s?/, "")).join(" "));
  const own = sentence(header(src));
  const base = path.basename(rel);
  const parts = [];
  if (rel.startsWith("src/app/") && /^(page|route|layout)\.tsx?$/.test(base)) {
    const r = route(rel);
    const kind = base.startsWith("route") ? `handler ${[...src.matchAll(/^export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/gm)].map((m) => m[1]).join("/")}` : base.startsWith("layout") ? "layout" : "page";
    const menu = kind === "page" ? NAV.get(r) : undefined;
    parts.push(`\`${r}\` ${kind}${menu ? ` «${menu}»` : ""}`);
    if (own) parts.push(own);
    return parts.join(" — ");
  }
  if (own) parts.push(own);
  const ex = exportsOf(src).filter((n) => n !== "default");
  if (ex.length) parts.push(`exports ${ex.slice(0, 8).join(", ")}${ex.length > 8 ? ` +${ex.length - 8}` : ""}`);
  return parts.join(" — ");
}

// ------------------------------------------------------------ the page
function render() {
  const list = files();
  const byDir = new Map();
  for (const f of list) {
    const d = path.dirname(f);
    if (!byDir.has(d)) byDir.set(d, []);
    byDir.get(d).push(f);
  }
  const out = [
    "# FILES — every source file, one line each",
    "",
    "Generated by `npm run map` (`scripts/map.mjs`) from each file's own header comment and exports; do not edit by hand.",
    "Start with [`MAP.md`](./MAP.md) (features → files, how data moves); use this page to look a file up.",
    "`tests/map.test.mjs` fails when a file is added or removed and this page was not regenerated.",
    "Not listed: generated files (`public/pglite`, `public/spir`), pictures, and the closed Windows version (`windows-archive/README.md`).",
    "",
    `${list.length} files.`,
    "",
  ];
  for (const [dir, fs_] of byDir) {
    out.push(`## ${dir}/`, "");
    for (const f of fs_) {
      const d = describe(f);
      out.push(`- \`${path.basename(f)}\`${d ? ` — ${d}` : ""}`);
    }
    out.push("");
  }
  return out.join("\n");
}

/** The files a written FILES.md lists, as paths. */
export function listed(md) {
  const paths = [];
  let dir = "";
  for (const line of md.split("\n")) {
    const h = line.match(/^## (.+)\/$/);
    if (h) { dir = h[1]; continue; }
    const f = line.match(/^- `([^`]+)`/);
    if (f && dir) paths.push(`${dir}/${f[1]}`);
  }
  return paths;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--check")) {
    const have = fs.existsSync(OUT) ? listed(fs.readFileSync(OUT, "utf8")) : [];
    const now = files();
    const added = now.filter((f) => !have.includes(f));
    const gone = have.filter((f) => !now.includes(f));
    if (added.length || gone.length) {
      console.error(`docs/FILES.md is out of date — run \`npm run map\`.\n${added.map((f) => `  + ${f}`).join("\n")}${gone.length ? "\n" : ""}${gone.map((f) => `  - ${f}`).join("\n")}`);
      process.exit(1);
    }
    console.log(`docs/FILES.md lists all ${now.length} files.`);
  } else {
    fs.writeFileSync(OUT, render());
    console.log(`docs/FILES.md: ${files().length} files.`);
  }
}
