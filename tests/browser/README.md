# Browser tests

These drive a real build in a real browser. They exist because several defects
in this app could not be reached any other way: an Arabic table column
collapsing in RTL, a platform picker that looked right and did nothing, a save
that crashed into the error boundary on a duplicate code, and a sync that
worked against PGlite but collided on a real Postgres.

They need a server, so they are **not** part of `npm test`.

```
npm run test:browser          # builds, starts a server, runs every suite
npm run test:browser -- lang  # just the suites whose name contains "lang"
```

Against a server you are already running:

```
SPIR_TEST_URL=http://localhost:3000 node tests/browser/e2e-lang.mjs
```

| Suite | What it holds |
| --- | --- |
| `crawl.mjs` | Every route in `routes.txt` renders, in Arabic, with Western digits and no error boundary |
| `e2e-lang.mjs` | The UI is Arabic and stays Arabic, and no language switcher is reachable |
| `e2e-ux.mjs` | Mobile tables, date inputs, empty states, save toasts, density, skeletons |
| `e2e-merged.mjs` | One platform: the welcome screen, the built-in account, working with no database |
| `e2e-validation.mjs` | A duplicate value is explained in place instead of crashing, and nothing typed is lost |
| `e2e-monsync.mjs` | The monitoring page reports database sync separately from the browser queue |

## Requirements

`playwright-core` and a Chromium. Both are optional: a suite that cannot find
them prints `SKIP` and exits 0, so a machine without them is not a failing
build.

```
npm i -D playwright-core
PLAYWRIGHT_CHROMIUM=/path/to/chrome npm run test:browser
```

Screenshots are written to `artifacts/`, which is not committed.
