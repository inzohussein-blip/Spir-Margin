/**
 * WhatsApp links for sending a document to a customer. Self-contained, so
 * the tests import it as is.
 *
 * wa.me wants the number in international form, digits only. Iraqi mobiles
 * are written locally as 07XX XXX XXXX; that becomes 9647XXXXXXXXX. With no
 * usable number the link still opens WhatsApp with the message ready, and
 * the person picks the chat.
 */
export function waNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("07")) d = `964${d.slice(1)}`;
  else if (d.length === 10 && d.startsWith("7")) d = `964${d}`;
  return d.length >= 10 && d.length <= 15 ? d : null;
}

export function waLink(phone: string | null | undefined, text: string): string {
  const n = waNumber(phone);
  return `https://wa.me/${n ?? ""}?text=${encodeURIComponent(text)}`;
}
