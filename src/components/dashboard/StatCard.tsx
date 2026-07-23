export function StatCard({
  label,
  value,
  hint,
  accent = "brand",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "brand" | "green" | "amber" | "red";
}) {
  const text: Record<string, string> = {
    brand: "text-brand",
    green: "text-ink-green-3",
    amber: "text-ink-amber-3",
    red: "text-ink-red-3",
  };
  const bar: Record<string, string> = {
    brand: "bg-brand",
    green: "bg-ink-green-3",
    amber: "bg-ink-amber-3",
    red: "bg-ink-red-3",
  };
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-outline-gray-2 bg-surface-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <span className={`absolute inset-y-0 start-0 w-1 ${bar[accent]} opacity-80`} aria-hidden />
      <div className="text-sm font-medium text-ink-gray-5">{label}</div>
      <div className={`mt-2 text-3xl font-bold tracking-tight tabular-nums ${text[accent]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-gray-4">{hint}</div>}
    </div>
  );
}
