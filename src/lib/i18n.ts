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
  // detail-page labels
  "Code": "الرمز", "Status": "الحالة", "City": "المدينة", "Address": "العنوان",
  "Contact": "جهة الاتصال", "Phone": "الهاتف", "Email": "البريد", "Type": "النوع",
  "Unit": "الوحدة", "Brand": "العلامة التجارية", "Buy price": "سعر الشراء", "Sell price": "سعر البيع",
  "Total billed": "إجمالي الفواتير", "Total outstanding": "المتبقّي", "Invoice": "فاتورة",
  "Date": "التاريخ", "Amount": "المبلغ", "Outstanding": "المتبقّي", "Details": "التفاصيل",
  "In stock": "في المخزون", "Batches": "الدفعات", "Item code": "رمز الصنف",
  "No invoices yet": "لا توجد فواتير بعد", "No devices yet": "لا توجد أجهزة بعد",
  "No stock on hand": "لا يوجد مخزون", "Sales invoices": "فواتير البيع", "Stock batches": "دفعات المخزون",
  "Serial no.": "الرقم التسلسلي", "Qty": "الكمية", "Expiry": "الانتهاء", "Back": "رجوع",
  // list-page labels
  "Billed": "المفوتر", "Invoices": "الفواتير", "New invoice": "فاتورة جديدة",
  "Sales orders": "أوامر البيع", "Invoice no.": "رقم الفاتورة", "Total": "الإجمالي",
  "Action": "إجراء", "Submit": "اعتماد", "Cancel": "إلغاء", "Pay": "دفع", "amount": "المبلغ",
  "No invoices yet — bill a lab for kits or devices": "لا توجد فواتير بعد — أنشئ فاتورة لمختبر",
  "New product": "منتج جديد", "Name": "الاسم", "Spare parts": "قطع غيار",
  "No products yet": "لا توجد منتجات بعد",
  "New lab": "مختبر جديد", "No labs yet": "لا توجد مختبرات بعد", "Contact name": "اسم جهة الاتصال",
  "Products (Items)": "المنتجات (الأصناف)", "Group": "المجموعة", "UOM": "الوحدة",
  "Buy": "شراء", "Sell": "بيع", "Last activity": "آخر نشاط",
  // dashboard
  "Record sale": "تسجيل بيع", "Total Profit": "إجمالي الربح", "Active Labs": "المختبرات النشطة",
  "Maintenance Alerts": "تنبيهات الصيانة", "Expiring Kits": "كِتّات قرب الانتهاء",
  "Outstanding Receivables": "الذمم المستحقة", "Open Purchase Orders": "أوامر شراء مفتوحة",
  "Active Work Orders": "أوامر عمل نشطة", "Pending Repairs": "إصلاحات معلّقة", "Open Issues": "تذاكر مفتوحة",
  "Outstanding Invoices": "الفواتير المستحقة", "No open receivables": "لا ذمم مستحقة",
  "No open purchase orders": "لا أوامر شراء مفتوحة", "No active labs": "لا مختبرات نشطة",
  "No devices need maintenance": "لا أجهزة تحتاج صيانة",
  "Upcoming Maintenance (PM Schedule · ≤ 60 days)": "الصيانة القادمة (خلال ≤ 60 يوماً)",
  "No scheduled visits in the next 60 days": "لا زيارات مجدولة خلال 60 يوماً",
  "Expiring Contracts (AMC · ≤ 60 days)": "عقود قرب الانتهاء (خلال ≤ 60 يوماً)",
  "No contracts expiring in the next 60 days": "لا عقود تنتهي خلال 60 يوماً",
  "Kits Near Expiry (≤ 90 days)": "كِتّات قرب الانتهاء (خلال ≤ 90 يوماً)",
  "No kits nearing expiry": "لا كِتّات قرب الانتهاء",
};

const dict: Record<Locale, Record<string, string>> = { ar, en: {} };

/** Translate a source string for a locale (falls back to the source itself). */
export function t(locale: Locale, key: string): string {
  return dict[locale]?.[key] ?? key;
}
