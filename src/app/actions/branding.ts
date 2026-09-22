"use server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db/pglite";

export interface BrandingState {
  error?: string;
  ok?: boolean;
  message?: string;
}

/**
 * Largest logo accepted. It is stored as a data URI and printed, so it has to
 * be small enough not to bloat every document render — a logo well past this
 * is a photograph, not a mark.
 */
const MAX_LOGO_BYTES = 512 * 1024;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

const clean = (fd: FormData, key: string): string | null => {
  const v = String(fd.get(key) ?? "").trim();
  return v === "" ? null : v;
};

export async function saveBrandingAction(
  _prev: BrandingState | null,
  fd: FormData,
): Promise<BrandingState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { error: "Only an admin can change this" };

  // A logo is optional; leaving the field empty keeps the current one, and
  // the separate remove button is what clears it.
  let logo: string | null | undefined;
  const file = fd.get("logo");
  if (file instanceof File && file.size > 0) {
    if (!LOGO_TYPES.includes(file.type)) {
      return { error: "The logo must be a PNG, JPEG, SVG or WebP image" };
    }
    if (file.size > MAX_LOGO_BYTES) {
      return { error: "That logo is too large — use one under 512 KB" };
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    logo = `data:${file.type};base64,${bytes.toString("base64")}`;
  }
  if (String(fd.get("remove_logo") ?? "") === "yes") logo = null;

  const { db } = await getDb();
  await db.query(
    `update _spir_branding set
        company_name   = $1,
        tagline        = $2,
        watermark_text = $3,
        watermark_on   = $4,
        address        = $5,
        city           = $6,
        phone          = $7,
        email          = $8,
        website        = $9,
        tax_id         = $10,
        doc_prefix     = $11,
        footer_note    = $12,
        logo           = case when $14 then $13 else logo end,
        updated_at     = now()
      where only_row`,
    [
      clean(fd, "company_name"),
      clean(fd, "tagline"),
      clean(fd, "watermark_text"),
      fd.get("watermark_on") != null,
      clean(fd, "address"),
      clean(fd, "city"),
      clean(fd, "phone"),
      clean(fd, "email"),
      clean(fd, "website"),
      clean(fd, "tax_id"),
      clean(fd, "doc_prefix")?.toUpperCase() ?? null,
      clean(fd, "footer_note"),
      logo ?? null,
      logo !== undefined,
    ],
  );

  // Deliberately no revalidatePath. Settings and every document that prints
  // the branding are force-dynamic, so they already re-read it — and
  // revalidating this route would remount the form and wipe out the
  // confirmation the person just earned, leaving a save that looks like it
  // did nothing.
  return { ok: true, message: "Saved. It will appear on printed documents." };
}
