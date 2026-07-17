import { PaperclipIcon, Trash2Icon, DownloadIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Panel } from "@/components/dashboard/Panel";
import { AttachmentUpload } from "./AttachmentUpload";
import { deleteAttachmentAction } from "@/app/actions/attachments";

interface Row { id: string; filename: string; mime_type: string; size_bytes: number; uploaded_by: string | null; created_at: string; }

const kb = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** ERPNext-style attachments panel for any record. Renders under a detail page. */
export async function Attachments({ entity, recordId, path }: { entity: string; recordId: string; path: string }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("attachments")
    .select("id, filename, mime_type, size_bytes, uploaded_by, created_at")
    .eq("entity", entity)
    .eq("record_id", recordId)
    .order("created_at", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <Panel title={`Attachments (${rows.length})`}>
      <div className="space-y-3 p-4">
        <AttachmentUpload entity={entity} recordId={recordId} path={path} />
        {rows.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-ink-gray-4"><PaperclipIcon size={14} /> No files attached yet.</p>
        ) : (
          <ul className="divide-y divide-outline-gray-1">
            {rows.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-brand hover:underline">
                  <DownloadIcon size={14} className="shrink-0" />
                  <span className="truncate">{a.filename}</span>
                </a>
                <div className="flex shrink-0 items-center gap-3 text-xs text-ink-gray-4">
                  <span>{kb(Number(a.size_bytes))}</span>
                  <span className="hidden sm:inline">{a.uploaded_by ?? ""}</span>
                  <span>{a.created_at?.slice(0, 10)}</span>
                  <form action={deleteAttachmentAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="path" value={path} />
                    <button className="text-ink-gray-4 hover:text-red-600" title="Delete"><Trash2Icon size={14} /></button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
