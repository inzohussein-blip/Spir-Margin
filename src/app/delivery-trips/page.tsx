import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { ListShell } from "@/components/desk/ListShell";
import { Indicator } from "@/components/desk/Indicator";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import {
  startDeliveryTripForm,
  completeDeliveryTripForm,
  cancelDeliveryTripForm,
} from "@/app/actions/delivery_trip";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  trip_no: string;
  driver_name: string | null;
  vehicle: string | null;
  departure_date: string;
  status: string;
  delivery_trip_stops: { id: string; arrived: boolean }[];
}

export default async function DeliveryTripsPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("delivery_trips")
    .select("id, trip_no, driver_name, vehicle, departure_date, status, delivery_trip_stops(id, arrived)")
    .order("departure_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const inTransit = rows.filter((r) => r.status === "in_transit");
  const done = rows.filter((r) => r.status === "completed");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t(locale, "In transit")} value={String(inTransit.length)} accent="amber" />
        <StatCard label={t(locale, "Completed")} value={String(done.length)} accent="green" />
        <StatCard label={t(locale, "Total")} value={String(rows.length)} accent="brand" />
      </div>

      <ListShell
        title={t(locale, "Delivery Trips")}
        breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "Stock") }]}
        count={rows.length}
        newHref="/delivery-trips/new"
        newLabel={t(locale, "New trip")}
        actions={<Link href="/delivery-notes" className="rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">{t(locale, "Delivery notes")}</Link>}
        filterPlaceholder="Filter by trip / driver…"
      >
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No delivery trips yet — group delivery notes into a route")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Trip no.")}</th>
                  <th className="px-4 py-2">{t(locale, "Driver")}</th>
                  <th className="px-4 py-2">{t(locale, "Vehicle")}</th>
                  <th className="px-4 py-2">{t(locale, "Departure")}</th>
                  <th className="px-4 py-2 text-right">{t(locale, "Stops")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                  <th className="px-4 py-2">{t(locale, "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((r) => {
                  const stops = r.delivery_trip_stops ?? [];
                  const arrived = stops.filter((s) => s.arrived).length;
                  return (
                    <tr key={r.id} className="hover:bg-surface-gray-1">
                      <td className="px-4 py-2 font-medium"><Link href={`/delivery-trips/${r.id}`} className="text-brand hover:underline">{r.trip_no}</Link></td>
                      <td className="px-4 py-2">{r.driver_name ?? "—"}</td>
                      <td className="px-4 py-2 text-ink-gray-5">{r.vehicle ?? "—"}</td>
                      <td className="px-4 py-2 text-ink-gray-5">{r.departure_date}</td>
                      <td className="px-4 py-2 text-right text-ink-gray-5">{arrived}/{stops.length}</td>
                      <td className="px-4 py-2"><Indicator status={r.status} /></td>
                      <td className="px-4 py-2">
                        {r.status === "draft" || r.status === "scheduled" ? (
                          <div className="flex gap-2">
                            <form action={startDeliveryTripForm}>
                              <input type="hidden" name="id" value={r.id} />
                              <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Start")}</button>
                            </form>
                            <form action={cancelDeliveryTripForm}>
                              <input type="hidden" name="id" value={r.id} />
                              <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">{t(locale, "Cancel")}</button>
                            </form>
                          </div>
                        ) : r.status === "in_transit" ? (
                          <div className="flex gap-2">
                            <form action={completeDeliveryTripForm}>
                              <input type="hidden" name="id" value={r.id} />
                              <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Complete")}</button>
                            </form>
                            <form action={cancelDeliveryTripForm}>
                              <input type="hidden" name="id" value={r.id} />
                              <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">{t(locale, "Cancel")}</button>
                            </form>
                          </div>
                        ) : (
                          <span className="text-xs text-ink-gray-4">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ListShell>
    </div>
  );
}
