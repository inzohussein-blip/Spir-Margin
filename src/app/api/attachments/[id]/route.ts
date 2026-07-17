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
  return new Response(buf, {
    headers: {
      "content-type": att.mime_type || "application/octet-stream",
      "content-disposition": `inline; filename="${encodeURIComponent(att.filename)}"`,
      "cache-control": "private, max-age=60",
    },
  });
}
