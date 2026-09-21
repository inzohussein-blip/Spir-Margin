/**
 * Loading skeletons, shaped per page type.
 *
 * A single generic skeleton is worse than none on pages it does not match:
 * showing three stat cards and a table while a form loads makes the layout
 * jump at swap-in. These mirror the real structure closely enough that the
 * content lands where the placeholder was.
 */

/** List page: title, toolbar, then rows. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="h-3 w-32 rounded bg-surface-gray-2" />
      <div className="flex items-center justify-between">
        <div className="h-7 w-44 rounded-lg bg-surface-gray-2" />
        <div className="h-9 w-28 rounded-lg bg-surface-gray-2" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-outline-gray-2 bg-surface-white">
        <div className="flex items-center justify-between border-b border-outline-gray-1 bg-surface-gray-1/40 px-3 py-2.5">
          <div className="h-7 w-56 rounded-md bg-surface-gray-2" />
          <div className="h-7 w-20 rounded-md bg-surface-gray-2" />
        </div>
        <div className="divide-y divide-outline-gray-1">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="h-4 w-20 rounded bg-surface-gray-1" />
              <div className="h-4 flex-1 rounded bg-surface-gray-1" />
              <div className="hidden h-4 w-24 rounded bg-surface-gray-1 sm:block" />
              <div className="hidden h-5 w-16 rounded-full bg-surface-gray-1 md:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Form page: back-link, title, then a card of labelled fields. */
export function FormSkeleton({ fields = 7 }: { fields?: number }) {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="h-3 w-24 rounded bg-surface-gray-2" />
      <div className="h-7 w-52 rounded-lg bg-surface-gray-2" />
      <div className="rounded-2xl border border-outline-gray-2 bg-surface-white p-5">
        <div className="mb-5 h-4 w-36 rounded bg-surface-gray-2" />
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: fields }, (_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 rounded bg-surface-gray-1" />
              <div className="h-9 rounded-lg bg-surface-gray-1" />
            </div>
          ))}
        </div>
        <div className="mt-6 h-9 w-28 rounded-lg bg-surface-gray-2" />
      </div>
    </div>
  );
}

/** Dashboard / workspace: KPI tiles above panels. */
export function DashboardSkeleton({ tiles = 4, panels = 2 }: { tiles?: number; panels?: number }) {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <div className="h-7 w-44 rounded-lg bg-surface-gray-2" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: tiles }, (_, i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-outline-gray-2 bg-surface-white p-5">
            <div className="h-3 w-24 rounded bg-surface-gray-1" />
            <div className="h-7 w-20 rounded bg-surface-gray-2" />
            <div className="h-3 w-28 rounded bg-surface-gray-1" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: panels }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-outline-gray-2 bg-surface-white">
            <div className="border-b border-outline-gray-1 bg-surface-gray-1/40 px-5 py-3">
              <div className="h-4 w-36 rounded bg-surface-gray-2" />
            </div>
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((r) => (
                <div key={r} className="h-5 rounded bg-surface-gray-1" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
