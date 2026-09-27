import { Pager, PAGE_SIZE, parsePage, pageRange } from "./Pager";

/**
 * A list page's window on its table: which page, and the search term. Lists
 * grow for years (labs, products, visits, entries…); rendering every row made
 * a list of a few thousand take seconds and megabytes, so each shows one page
 * and searches the whole table on the server (`.search()` in rest.ts).
 */
export type ListQuery = { page?: string; q?: string };

export function listWindow(sp?: ListQuery) {
  const page = parsePage(sp?.page);
  const [from, to] = pageRange(page);
  return { page, from, to, q: String(sp?.q ?? "").trim().slice(0, 100) };
}

/** The pager under a list, keeping the search term. */
export function ListFooter({ basePath, page, total, q }: { basePath: string; page: number; total: number; q?: string }) {
  return (
    <Pager
      page={page}
      pageSize={PAGE_SIZE}
      total={total}
      hrefFor={(p) => `${basePath}?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) }).toString()}`}
    />
  );
}
