import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { setAppointmentStatusForm } from "@/app/actions/appointment";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  appointment_no: string;
  purpose: string;
  scheduled_time: string;
  status: string;
  contact_name: string | null;
  labs: { name: string } | null;
  devices: { asset_code: string } | null;
}

const statusBadge: Record<string, string> = {
  open: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function AppointmentsPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("appointments")
    .select("id, appointment_no, purpose, scheduled_time, status, contact_name, labs(name), devices(asset_code)")
    .order("scheduled_time", { ascending: true });
  const rows = (data as unknown as Row[]) ?? [];
  const upcoming = rows.filter((r) => (r.status === "open" || r.status === "confirmed") && new Date(r.scheduled_time) >= new Date()).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">Appointments</h1>
        <Link href="/appointments/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New appointment</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Upcoming" value={String(upcoming)} accent="brand" />
        <StatCard label="Completed" value={String(rows.filter((r) => r.status === "completed").length)} accent="green" />
        <StatCard label="Total" value={String(rows.length)} accent="amber" />
      </div>

      <Panel title={`Appointments (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text="No appointments yet — schedule an install or service visit" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">No.</th>
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Purpose</th>
                  <th className="px-4 py-2">Lab</th>
                  <th className="px-4 py-2">Device</th>
                  <th className="px-4 py-2">Contact</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2 font-medium">{a.appointment_no}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{new Date(a.scheduled_time).toLocaleString()}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{a.purpose}</td>
                    <td className="px-4 py-2">{a.labs?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{a.devices?.asset_code ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{a.contact_name ?? "—"}</td>
                    <td className="px-4 py-2">
                      <form action={setAppointmentStatusForm} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={a.id} />
                        <select name="status" defaultValue={a.status} className="rounded-md border border-outline-gray-2 px-2 py-1 text-xs">
                          <option value="open">open</option>
                          <option value="confirmed">confirmed</option>
                          <option value="completed">completed</option>
                          <option value="cancelled">cancelled</option>
                        </select>
                        <button className="rounded-md bg-brand px-2 py-1 text-xs font-medium text-white hover:bg-brand-dark">Set</button>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[a.status] ?? "bg-surface-gray-2"}`}>{a.status}</span>
                      </form>
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
