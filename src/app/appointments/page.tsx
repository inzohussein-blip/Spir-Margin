import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { ListShell } from "@/components/desk/ListShell";
import { setAppointmentStatusForm } from "@/app/actions/appointment";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

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
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("appointments")
    .select("id, appointment_no, purpose, scheduled_time, status, contact_name, labs(name), devices(asset_code)")
    .order("scheduled_time", { ascending: true });
  const rows = (data as unknown as Row[]) ?? [];
  const upcoming = rows.filter((r) => (r.status === "open" || r.status === "confirmed") && new Date(r.scheduled_time) >= new Date()).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t(locale, "Upcoming")} value={String(upcoming)} accent="brand" />
        <StatCard label={t(locale, "Completed")} value={String(rows.filter((r) => r.status === "completed").length)} accent="green" />
        <StatCard label={t(locale, "Total")} value={String(rows.length)} accent="amber" />
      </div>

      <ListShell
        title={t(locale, "Appointments")}
        breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "CRM") }]}
        count={rows.length}
        newHref="/appointments/new"
        newLabel={t(locale, "New appointment")}
      >
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No appointments yet — schedule an install or service visit")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "No.")}</th>
                  <th className="px-4 py-2">{t(locale, "When")}</th>
                  <th className="px-4 py-2">{t(locale, "Purpose")}</th>
                  <th className="px-4 py-2">{t(locale, "Lab")}</th>
                  <th className="px-4 py-2">{t(locale, "Device")}</th>
                  <th className="px-4 py-2">{t(locale, "Contact")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2 font-medium"><Link href={`/appointments/${a.id}`} className="text-brand hover:underline">{a.appointment_no}</Link></td>
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
                        <button className="rounded-md bg-brand px-2 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Set")}</button>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[a.status] ?? "bg-surface-gray-2"}`}>{a.status}</span>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ListShell>
    </div>
  );
}
