import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Att { filename: string; mime_type: string; data_base64: string; }

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("attachments")
    .select("filename, mime_type, data_base64")
    .eq("id", params.id)
    .single();
  const att = data as unknown as Att | null;
  if (!att) return new Response("Not found", { status: 404 });

  const buf = Buffer.from(att.data_base64, "base64");

  // Images can render inline (safe to preview); everything else — and notably
  // HTML/SVG, which could carry scripts — is forced to download, so a malicious
  // upload can never execute in the app's origin (stored-XSS defence).
  const mime = att.mime_type || "application/octet-stream";
  const safeInline = /^image\/(png|jpe?g|gif|webp|bmp)$/i.test(mime);
  const disposition = safeInline ? "inline" : "attachment";

  return new Response(buf, {
    headers: {
      "content-type": safeInline ? mime : "application/octet-stream",
      "content-disposition": `${disposition}; filename="${encodeURIComponent(att.filename)}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=60",
    },
  });
}
