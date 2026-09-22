import "server-only";
import { getDb } from "@/lib/db/pglite";

/**
 * The company's own identity, as it appears on screen and on paper.
 *
 * Local to this machine on purpose: the table is `_spir`-prefixed, so the
 * change log excludes it and a second branch can carry its own letterhead
 * without one overwriting the other.
 */
export interface Branding {
  companyName: string | null;
  tagline: string | null;
  logo: string | null;
  watermarkText: string | null;
  watermarkOn: boolean;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  taxId: string | null;
  docPrefix: string | null;
  footerNote: string | null;
}

export const EMPTY_BRANDING: Branding = {
  companyName: null, tagline: null, logo: null,
  watermarkText: null, watermarkOn: false,
  address: null, city: null, phone: null, email: null,
  website: null, taxId: null, docPrefix: null, footerNote: null,
};

interface Row {
  company_name: string | null; tagline: string | null; logo: string | null;
  watermark_text: string | null; watermark_on: boolean;
  address: string | null; city: string | null; phone: string | null;
  email: string | null; website: string | null; tax_id: string | null;
  doc_prefix: string | null; footer_note: string | null;
}

export async function getBranding(): Promise<Branding> {
  try {
    const { db } = await getDb();
    const r = await db.query<Row>(
      `select company_name, tagline, logo, watermark_text, watermark_on,
              address, city, phone, email, website, tax_id, doc_prefix, footer_note
         from _spir_branding`,
    );
    const b = r.rows[0];
    if (!b) return EMPTY_BRANDING;
    return {
      companyName: b.company_name,
      tagline: b.tagline,
      logo: b.logo,
      watermarkText: b.watermark_text,
      watermarkOn: !!b.watermark_on,
      address: b.address,
      city: b.city,
      phone: b.phone,
      email: b.email,
      website: b.website,
      taxId: b.tax_id,
      docPrefix: b.doc_prefix,
      footerNote: b.footer_note,
    };
  } catch {
    // A database older than migration 0095; the documents fall back to the
    // product's own name rather than failing to print.
    return EMPTY_BRANDING;
  }
}

/** The contact lines to print under the company name, in reading order. */
export function brandingLines(b: Branding): string[] {
  return [
    [b.address, b.city].filter(Boolean).join(" — "),
    [b.phone, b.email].filter(Boolean).join(" · "),
    b.website ?? "",
    b.taxId ?? "",
  ].filter((l) => l.trim().length > 0);
}
