/**
 * Instant loading skeleton shown by Next.js during a route transition. Because
 * pages are server-rendered on every request, this Suspense fallback paints
 * immediately on navigation (and on prefetch), so the app never feels frozen.
 */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <div className="h-8 w-56 rounded-lg bg-surface-gray-2" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-2xl border border-outline-gray-2 bg-surface-white" />
        ))}
      </div>
      <div className="rounded-2xl border border-outline-gray-2 bg-surface-white">
        <div className="border-b border-outline-gray-1 p-4">
          <div className="h-4 w-40 rounded bg-surface-gray-2" />
        </div>
        <div className="space-y-3 p-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-5 rounded bg-surface-gray-1" />
          ))}
        </div>
      </div>
    </div>
  );
}
