"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function uploadAttachmentAction(_prev: unknown, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };

  const entity = String(formData.get("entity") ?? "");
  const record_id = String(formData.get("record_id") ?? "");
  const file = formData.get("file") as File | null;
  const path = String(formData.get("path") ?? "");
  if (!entity || !record_id) return { error: "Missing target record" };
  if (!file || file.size === 0) return { error: "Choose a file" };
  if (file.size > MAX_BYTES) return { error: "File too large (max 5 MB)" };

  const buf = Buffer.from(await file.arrayBuffer());
  const supabase = createClient();
  const { error } = await supabase.from("attachments").insert({
    entity,
    record_id,
    filename: file.name,
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size,
    data_base64: buf.toString("base64"),
    uploaded_by: user.email,
  });
  if (error) return { error: "Upload failed" };
  if (path) revalidatePath(path);
  return { ok: true as const, message: `Uploaded ${file.name}` };
}

export async function deleteAttachmentAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(formData.get("id"));
  const path = String(formData.get("path") ?? "");
  const supabase = createClient();
  await supabase.from("attachments").delete().eq("id", id);
  if (path) revalidatePath(path);
}
