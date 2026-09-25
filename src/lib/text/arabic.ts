/**
 * Arabic-aware matching, for searching. Self-contained, so the tests import
 * it as is.
 *
 * People type the same name several ways: أحمد / احمد / إحمد, مكتبة / مكتبه,
 * الكندي / الكندى, with or without diacritics or a stretched letter (ـ), and
 * with Western or Arabic-Indic digits. Search compares both sides folded
 * the same way; what is stored is never changed.
 *
 * The same folding exists in the database as fn_ar_norm (migration 0114), so
 * a search that runs there and one that runs in the browser agree.
 */
export function foldArabic(text: string): string {
  return text
    .replace(/[ً-ٰٟـ]/g, "") // diacritics, superscript alef, tatweel
    .replace(/[آأإٱ]/g, "ا") // آ أ إ ٱ → ا
    .replace(/ة/g, "ه") // ة → ه
    .replace(/ى/g, "ي") // ى → ي
    .replace(/ؤ/g, "و") // ؤ → و
    .replace(/ئ/g, "ي") // ئ → ي
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .toLowerCase();
}

/** Does `text` contain `needle`, Arabic spelling variants forgiven? */
export function arabicIncludes(text: string, needle: string): boolean {
  const n = foldArabic(needle.trim());
  return !n || foldArabic(text).includes(n);
}
