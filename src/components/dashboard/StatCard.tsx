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
  const accents: Record<string, string> = {
    brand: "text-brand",
    green: "text-ink-green-3",
    amber: "text-ink-amber-3",
    red: "text-ink-red-3",
  };
  return (
    <div className="rounded-xl border border-outline-gray-2 bg-surface-white p-5 shadow-sm">
      <div className="text-sm font-medium text-ink-gray-5">{label}</div>
      <div className={`mt-2 text-3xl font-bold ${accents[accent]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-gray-4">{hint}</div>}
    </div>
  );
}
