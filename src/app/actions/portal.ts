"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Open a fault ticket from the customer portal. The lab is taken ONLY from the
 * signed-in portal user's session — never from client input — so a hospital can
 * only ever raise tickets against its own lab.
 */
export async function createPortalTicket(fd: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "customer" || !user.lab_id) {
    throw new Error("Not authorised");
  }
  const subject = String(fd.get("subject") ?? "").trim();
  if (!subject) throw new Error("Please describe the problem");
  const description = String(fd.get("description") ?? "").trim() || null;

  const supabase = createClient();
  const issue_no = `PORTAL-${Date.now()}`;
  const { error } = await supabase.from("issues").insert({
    issue_no,
    subject,
    description,
    lab_id: user.lab_id, // authoritative — from the session, not the form
    status: "open",
    priority: "Medium",
    raised_by: user.email,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/portal/tickets");
}
