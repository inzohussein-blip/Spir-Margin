import { createClient } from "@/lib/supabase/server";
import { EmptyRow } from "@/components/dashboard/Panel";
import { ListShell } from "@/components/desk/ListShell";
import { Indicator } from "@/components/desk/Indicator";
import type { Lab } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LabsPage() {
  const supabase = createClient();
  const { data } = await supabase.from("labs").select("*").order("name");
  const labs = (data as Lab[]) ?? [];

  return (
    <ListShell
      title="Labs"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Selling" }]}
      count={labs.length}
      newHref="/labs/new"
      newLabel="New lab"
    >
      {labs.length === 0 ? (
        <EmptyRow text="No labs yet" />
      ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">City</th>
                  <th className="px-4 py-2">Contact</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {labs.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2 font-medium">{l.code}</td>
                    <td className="px-4 py-2">{l.name}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{l.city ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">
                      {l.contact_name ?? "—"}
                    </td>
                    <td className="px-4 py-2"><Indicator status={l.status} /></td>
                    <td className="px-4 py-2 text-ink-gray-5">
                      {l.last_activity_at
                        ? new Date(l.last_activity_at).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </ListShell>
  );
}
