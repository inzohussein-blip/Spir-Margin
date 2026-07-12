import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { evaluateQualityInspectionForm, cancelQualityInspectionForm } from "@/app/actions/quality";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  qi_no: string;
  report_date: string;
  inspection_type: string;
  status: string;
  inspected_by: string | null;
  products: { name: string } | null;
  quality_inspection_readings: { id: string }[];
}

const statusBadge: Record<string, string> = {
  pending: "bg-surface-gray-2 text-ink-gray-6",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-orange-100 text-orange-700",
};

export default async function QualityInspectionsPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("quality_inspections")
    .select("id, qi_no, report_date, inspection_type, status, inspected_by, products(name), quality_inspection_readings(id)")
    .order("report_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const accepted = rows.filter((r) => r.status === "accepted").length;
  const rejected = rows.filter((r) => r.status === "rejected").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">Quality Inspections</h1>
        <Link href="/quality-inspections/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New inspection</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Accepted" value={String(accepted)} accent="green" />
        <StatCard label="Rejected" value={String(rejected)} accent="brand" />
        <StatCard label="Total" value={String(rows.length)} accent="amber" />
      </div>

      <Panel title={`Inspections (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text="No inspections yet — record incoming/outgoing QC for kits and devices" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">QI no.</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Readings</th>
                  <th className="px-4 py-2">Inspector</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((q) => (
                  <tr key={q.id}>
                    <td className="px-4 py-2 font-medium">{q.qi_no}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{q.inspection_type}</td>
                    <td className="px-4 py-2">{q.products?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{q.report_date}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{q.quality_inspection_readings?.length ?? 0}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{q.inspected_by ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[q.status] ?? "bg-surface-gray-2"}`}>
                        {q.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {q.status !== "cancelled" ? (
                        <div className="flex gap-2">
                          <form action={evaluateQualityInspectionForm}>
                            <input type="hidden" name="id" value={q.id} />
                            <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">Evaluate</button>
                          </form>
                          <form action={cancelQualityInspectionForm}>
                            <input type="hidden" name="id" value={q.id} />
                            <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">Cancel</button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-xs text-ink-gray-4">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
