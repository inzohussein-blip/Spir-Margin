/**
 * Iraq's governorates, for the transport authorisations.
 *
 * A fixed list rather than a table: it is stable, it is the same on every
 * machine, and a free-text field here would mean two spellings of the same
 * governorate on documents that are shown at checkpoints.
 */
export const GOVERNORATES = [
  "بغداد",
  "البصرة",
  "نينوى",
  "أربيل",
  "السليمانية",
  "دهوك",
  "كركوك",
  "النجف",
  "كربلاء",
  "بابل",
  "الأنبار",
  "ديالى",
  "ذي قار",
  "المثنى",
  "القادسية",
  "ميسان",
  "واسط",
  "صلاح الدين",
] as const;

export type Governorate = (typeof GOVERNORATES)[number];
