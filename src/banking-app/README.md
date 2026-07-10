# banking-app — original Frappe Banking source (vendored)

All 139 source files from `erpnext-reference/banking/src` are copied here, in
their original structure, so the complete banking front-end lives inside this
Next.js project.

## Status

This tree is **excluded from the Next.js build** (`tsconfig.json` `exclude` +
`.eslintignore`) because, as written, it cannot compile or run in this project:

| Blocker | This tree | Our project |
| ------- | --------- | ----------- |
| Data layer | `frappe-react-sdk` → a running **Frappe/ERPNext** backend | **Supabase** |
| React | 19 (`radix-ui` unified pkg) | 18 |
| Styling | **Tailwind v4** (`@theme`, Espresso design system) | Tailwind v3 |
| Bundler / routing | **Vite** + `react-router` | Next.js App Router |

## What actually runs

The banking **functionality** has been re-implemented natively for this stack
under `src/app/banking/**` + `src/app/actions/banking.ts` on Supabase
(reconciliation, matching rules, payments, CSV import). That is the live module.

## To make this original tree run (future migration phase)

1. Upgrade the project to **React 19** and **Tailwind v4**; port the Espresso
   design tokens from `index.css`.
2. Add the deps it imports (`radix-ui`, `class-variance-authority`, `cmdk`,
   `react-hook-form`, `sonner`, `react-day-picker`, `chrono-node`, `dayjs`,
   `react-markdown`, `lucide-react`, …).
3. Rewrite the ~30 `frappe-react-sdk`-coupled files (features/hooks/pages) to
   call Supabase instead of Frappe REST.

Folder map: `types/` (17, pure interfaces), `components/ui/` (43 shadcn/Radix),
`components/common/` + `components/features/` (feature logic), `hooks/`,
`lib/` (utils), `pages/` (SPA screens), plus Vite bootstrap `App.tsx` /
`main.tsx` / `index.css`.
