// Lightweight i18n: Arabic (primary) + English (secondary), no external library.
// Keyed by the English source string so components can call t(locale, "Labs").

export type Locale = "ar" | "en";
export const LOCALE_COOKIE = "spir_locale";
export const DEFAULT_LOCALE: Locale = "ar";

const ar: Record<string, string> = {
  // shell / navbar
  "Search or jump to…": "ابحث أو انتقل…",
  "Search records, lists, or type 'new'…": "ابحث في السجلات أو القوائم، أو اكتب 'new'…",
  "Create": "إنشاء",
  "Create new": "إنشاء جديد",
  "Go to": "الانتقال إلى",
  "Records": "السجلات",
  "Sign out": "تسجيل الخروج",
  "Account": "الحساب",
  "العربية": "العربية",
  "English": "English",
  // groups
  "Home": "الرئيسية", "CRM": "إدارة العملاء", "Selling": "المبيعات", "Buying": "المشتريات",
  "Stock": "المخزون", "Manufacturing": "التصنيع", "Assets": "الأصول", "Maintenance": "الصيانة",
  "Support": "الدعم", "Accounting": "المحاسبة", "Reports": "التقارير", "Tools": "الأدوات", "Setup": "الإعداد",
  // items
  "Dashboard": "لوحة التحكم", "Leads": "العملاء المحتملون", "Opportunities": "الفرص",
  "Appointments": "المواعيد", "Contracts": "العقود", "Labs": "المختبرات", "Quotations": "عروض الأسعار",
  "Sales Orders": "أوامر البيع", "Sales Invoices": "فواتير البيع", "Blanket Orders": "الاتفاقيات الإطارية",
  "Credit Limits": "حدود الائتمان", "Pricing Rules": "قواعد التسعير", "Suppliers": "الموردون",
  "RFQs": "طلبات عروض الأسعار", "Purchase Orders": "أوامر الشراء", "Purchase Receipts": "سندات الاستلام",
  "Purchases": "المشتريات", "Products": "المنتجات", "Bundles": "الحزم", "Kits": "الكِتّات",
  "Serials": "الأرقام التسلسلية", "Warehouses": "المخازن", "Stock Entries": "حركات المخزون",
  "Pick Lists": "أوراق التجهيز", "Delivery Trips": "رحلات التوصيل", "Stock Balance": "رصيد المخزون",
  "Prices": "الأسعار", "BOMs": "قوائم المواد", "Work Orders": "أوامر العمل", "Quality": "الجودة",
  "Devices": "الأجهزة", "Movements": "التنقلات", "Installations": "التركيبات", "Repairs": "الإصلاحات",
  "Visits": "الزيارات", "PM Schedules": "جداول الصيانة", "Teams": "الفرق", "Issues": "التذاكر",
  "Warranty": "الضمان", "Payment Requests": "طلبات الدفع", "Banking": "البنوك", "Accounts": "الحسابات",
  "Currency": "العملات", "All Reports": "كل التقارير", "Receivables Aging": "أعمار الذمم",
  "Profitability": "الربحية", "Calculator": "الحاسبة", "Profit Calculator": "حاسبة الأرباح",
  "Currency Converter": "محوّل العملات", "Masters": "البيانات الأساسية", "Users": "المستخدمون",
  // singular create-menu labels
  "Lab": "مختبر", "Quotation": "عرض سعر", "Sales Order": "أمر بيع", "Sales Invoice": "فاتورة بيع",
  "Purchase Order": "أمر شراء", "Purchase Receipt": "سند استلام", "Product": "منتج",
  "Device": "جهاز", "Issue": "تذكرة",
};

const dict: Record<Locale, Record<string, string>> = { ar, en: {} };

/** Translate a source string for a locale (falls back to the source itself). */
export function t(locale: Locale, key: string): string {
  return dict[locale]?.[key] ?? key;
}
