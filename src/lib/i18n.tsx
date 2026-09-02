import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "ar" | "en";

type Dict = Record<string, { ar: string; en: string }>;

export const dict: Dict = {
  // generic
  appTagline: { ar: "\n", en: "\n" },
  menu: { ar: "المنيو", en: "Menu" },
  cart: { ar: "السلة", en: "Cart" },
  myAccount: { ar: "حسابي", en: "My account" },
  admin: { ar: "لوحة التحكم", en: "Admin" },
  signIn: { ar: "تسجيل الدخول", en: "Sign in" },
  signUp: { ar: "إنشاء حساب", en: "Sign up" },
  signOut: { ar: "تسجيل الخروج", en: "Sign out" },
  email: { ar: "البريد الإلكتروني", en: "Email" },
  password: { ar: "كلمة المرور", en: "Password" },
  fullName: { ar: "الاسم الكامل", en: "Full name" },
  save: { ar: "حفظ", en: "Save" },
  cancel: { ar: "إلغاء", en: "Cancel" },
  confirm: { ar: "تأكيد", en: "Confirm" },
  add: { ar: "إضافة", en: "Add" },
  edit: { ar: "تعديل", en: "Edit" },
  exploreMenu: { ar: "استكشف المنيو", en: "Explore the Menu" },
  viewCart: { ar: "عرض السلة", en: "View Cart" },
  ourMenu: { ar: "المنيو", en: "Our Menu" },
  brandIdentity: { ar: "هوية المطعم", en: "Brand Identity" },
  logoHint: {
    ar: "يظهر في رأس الصفحة ويُستخدم كأيقونة الموقع (favicon).",
    en: "Shown in the header and used as the site icon (favicon).",
  },
  heroImage: { ar: "صورة الواجهة", en: "Menu Hero Image" },
  heroImageHint: {
    ar: "الصورة الكبيرة أعلى صفحة المنيو العامة.",
    en: "The large visual on the public menu homepage.",
  },
  search: { ar: "بحث", en: "Search" },
  loading: { ar: "جاري التحميل...", en: "Loading..." },
  noData: { ar: "لا توجد بيانات", en: "No data yet" },
  error: { ar: "حدث خطأ", en: "Something went wrong" },
  retry: { ar: "إعادة المحاولة", en: "Try again" },
  export: { ar: "تصدير", en: "Export" },
  total: { ar: "الإجمالي", en: "Total" },
  subtotal: { ar: "المجموع", en: "Subtotal" },
  quantity: { ar: "الكمية", en: "Qty" },
  price: { ar: "السعر", en: "Price" },
  date: { ar: "التاريخ", en: "Date" },
  status: { ar: "الحالة", en: "Status" },
  actions: { ar: "إجراءات", en: "Actions" },
  notes: { ar: "ملاحظات", en: "Notes" },
  all: { ar: "الكل", en: "All" },
  amount: { ar: "المبلغ", en: "Amount" },
  product: { ar: "الصنف", en: "Item" },

  balance: { ar: "الرصيد", en: "Balance" },
  customer: { ar: "العميل", en: "Customer" },
  visitor: { ar: "زائر", en: "Visitor" },
  back: { ar: "رجوع", en: "Back" },
  close: { ar: "إغلاق", en: "Close" },
  optional: { ar: "اختياري", en: "optional" },
  orderFor: { ar: "الطلب لـ", en: "Order for" },
  unitPrice: { ar: "سعر الوحدة", en: "Unit price" },
  itemsCount: { ar: "صنف", en: "items" },
  searchResults: { ar: "نتائج البحث", en: "Search results" },

  // menu / ordering
  browseMenu: { ar: "تصفح المنيو", en: "Browse the menu" },
  addToCart: { ar: "أضف للسلة", en: "Add to cart" },
  outOfStock: { ar: "غير متوفر", en: "Out of stock" },
  emptyCart: { ar: "سلتك فارغة", en: "Your cart is empty" },
  emptyCartHint: { ar: "أضف أصنافًا من المنيو للبدء", en: "Add items from the menu to get started" },
  checkout: { ar: "إتمام الطلب", en: "Checkout" },
  orderAsVisitor: { ar: "طلب نقدي (زائر)", en: "Cash order (visitor)" },
  orderOnAccount: { ar: "الطلب على الحساب", en: "Order on account" },
  visitorName: { ar: "الاسم", en: "Your name" },
  visitorPhone: { ar: "رقم الهاتف", en: "Phone number" },
  placeOrder: { ar: "تأكيد الطلب", en: "Place order" },
  orderPlaced: { ar: "تم استلام طلبك بنجاح", en: "Your order was placed" },
  orderPlacedHint: {
    ar: "سيقوم المطعم بتجهيز طلبك. الدفع نقدًا عند الاستلام.",
    en: "The restaurant is preparing your order. Payment is cash on delivery.",
  },
  orderNumber: { ar: "رقم الطلب", en: "Order #" },
  newOrder: { ar: "طلب جديد", en: "New order" },
  payLater: { ar: "يُضاف إلى حسابك ويُسدد لاحقًا", en: "Added to your account, settled later" },
  payNowCash: { ar: "الدفع نقدًا عند الاستلام", en: "Pay cash on pickup/delivery" },
  payByInstapay: { ar: "ادفع عبر Instapay", en: "Pay by Instapay" },
  payByInstapayHint: { ar: "ادفع اختياريًا عبر Instapay في تبويب جديد", en: "Optionally pay via Instapay in a new tab" },
  notifications: { ar: "الإشعارات", en: "Notifications" },
  noNotifications: { ar: "لا توجد إشعارات", en: "No notifications" },
  confirmOrder: { ar: "تأكيد الطلب", en: "Confirm order" },
  completeOrder: { ar: "تم الانتهاء", en: "Mark completed" },
  cancelOrder: { ar: "إلغاء", en: "Cancel" },

  // auth
  createAccountRequest: { ar: "طلب فتح حساب", en: "Request an account" },
  pendingApproval: { ar: "حسابك في انتظار موافقة الإدارة", en: "Your account is pending admin approval" },
  pendingApprovalHint: {
    ar: "سيتم تفعيل الطلب على الحساب بمجرد موافقة الإدارة.",
    en: "Ordering on account unlocks once an admin approves you.",
  },
  rejectedAccount: { ar: "تم رفض طلب الحساب", en: "Your account request was rejected" },
  deactivatedAccount: { ar: "تم إلغاء هذا الحساب", en: "This account has been deactivated" },
  deactivatedAccountHint: {
    ar: "تم إلغاء هذا الحساب، برجاء التواصل مع الإدارة.",
    en: "This account has been deactivated. Please contact management.",
  },
  haveAccount: { ar: "لديك حساب بالفعل؟", en: "Already have an account?" },
  noAccount: { ar: "ليس لديك حساب؟", en: "Don't have an account?" },

  // admin nav
  dashboard: { ar: "الرئيسية", en: "Dashboard" },
  menuMgmt: { ar: "إدارة المنيو", en: "Menu" },
  orders: { ar: "الطلبات", en: "Orders" },
  customers: { ar: "الحسابات", en: "Accounts" },
  expenses: { ar: "المصروفات", en: "Expenses" },
  reports: { ar: "التقارير", en: "Reports" },
  settings: { ar: "الإعدادات", en: "Settings" },

  // dashboard
  todaySales: { ar: "المبيعات", en: "Sales" },
  accountSales: { ar: "مبيعات الحسابات", en: "Account sales" },
  cashSales: { ar: "المبيعات النقدية", en: "Cash sales" },
  outstanding: { ar: "الأرصدة المستحقة", en: "Outstanding" },
  totalExpenses: { ar: "المصروفات", en: "Expenses" },
  netProfit: { ar: "صافي الربح التقديري", en: "Estimated net profit" },
  collections: { ar: "التحصيلات", en: "Collections" },
  recentOrders: { ar: "أحدث الطلبات", en: "Recent orders" },
  pendingRequests: { ar: "طلبات الحسابات المعلقة", en: "Pending account requests" },

  // date presets
  today: { ar: "اليوم", en: "Today" },
  last7: { ar: "آخر ٧ أيام", en: "Last 7 days" },
  last10: { ar: "آخر ١٠ أيام", en: "Last 10 days" },
  last30: { ar: "آخر ٣٠ يومًا", en: "Last 30 days" },
  thisMonth: { ar: "هذا الشهر", en: "This month" },
  lastMonth: { ar: "الشهر الماضي", en: "Last month" },
  last6Months: { ar: "آخر ٦ أشهر", en: "Last 6 months" },
  last7Months: { ar: "آخر ٧ أشهر", en: "Last 7 months" },
  customRange: { ar: "فترة مخصصة", en: "Custom range" },
  filterByDate: { ar: "فلترة بالتاريخ", en: "Filter by date" },
  clearFilter: { ar: "مسح الفلتر", en: "Clear filter" },
  showingLabel: { ar: "عرض", en: "Showing" },
  fullHistory: { ar: "كل السجل", en: "Full history" },
  from: { ar: "من", en: "From" },
  to: { ar: "إلى", en: "To" },

  // menu mgmt
  categories: { ar: "الأقسام", en: "Categories" },
  products: { ar: "المنتجات", en: "Products" },
  addCategory: { ar: "إضافة قسم", en: "Add category" },
  addProduct: { ar: "إضافة منتج", en: "Add product" },
  nameAr: { ar: "الاسم بالعربية", en: "Name (Arabic)" },
  nameEn: { ar: "الاسم بالإنجليزية", en: "Name (English)" },
  descAr: { ar: "الوصف بالعربية", en: "Description (Arabic)" },
  descEn: { ar: "الوصف بالإنجليزية", en: "Description (English)" },
  category: { ar: "القسم", en: "Category" },
  image: { ar: "الصورة", en: "Image" },
  sortOrder: { ar: "الترتيب", en: "Sort order" },
  active: { ar: "مفعّل", en: "Active" },
  inactive: { ar: "غير مفعّل", en: "Inactive" },
  available: { ar: "متاح", en: "Available" },
  archived: { ar: "مؤرشف", en: "Archived" },
  archive: { ar: "أرشفة", en: "Archive" },
  unarchive: { ar: "إلغاء الأرشفة", en: "Unarchive" },
  showArchived: { ar: "عرض الأصناف المؤرشفة", en: "Show archived items" },
  archiveHint: {
    ar: "الأرشفة = إخفاء الصنف نهائيًا من المنيو مع الاحتفاظ بسجله في الطلبات السابقة. أما «متاح / غير متاح» فهو إيقاف مؤقت للصنف مع بقائه في المنيو.",
    en: "Archiving hides an item from the menu permanently while keeping its order history. Available / Unavailable is a temporary pause, the item stays in the menu.",
  },

  uncategorized: { ar: "بدون قسم", en: "Uncategorized" },
  newCategoryInline: { ar: "قسم جديد...", en: "New category..." },
  uploadImage: { ar: "رفع صورة", en: "Upload image" },

  // orders admin
  orderType: { ar: "نوع الطلب", en: "Type" },
  paymentStatus: { ar: "حالة الدفع", en: "Payment" },
  markPaid: { ar: "تعليم كمدفوع", en: "Mark as paid" },
  paid: { ar: "مدفوع", en: "Paid" },
  unpaid: { ar: "غير مدفوع", en: "Unpaid" },
  orderDetails: { ar: "تفاصيل الطلب", en: "Order details" },
  items: { ar: "الأصناف", en: "Items" },
  st_pending: { ar: "قيد الانتظار", en: "Pending" },
  st_confirmed: { ar: "مؤكد", en: "Confirmed" },
  st_preparing: { ar: "قيد التحضير", en: "Preparing" },
  st_ready: { ar: "جاهز", en: "Ready" },
  st_completed: { ar: "مكتمل", en: "Completed" },
  st_cancelled: { ar: "ملغي", en: "Cancelled" },
  type_ACCOUNT: { ar: "على الحساب", en: "Account" },
  type_CASH: { ar: "نقدي", en: "Cash" },

  // customers
  displayName: { ar: "الاسم الداخلي", en: "Display name" },
  editDisplayName: { ar: "تعديل الاسم الداخلي", en: "Edit display name" },
  displayNameHint: {
    ar: "اسم داخلي يظهر للإدارة فقط بدل اسم العميل المسجل.",
    en: "Internal label shown in the admin UI instead of the customer's own name.",
  },
  changePassword: { ar: "تغيير كلمة السر", en: "Change password" },
  newPassword: { ar: "كلمة السر الجديدة", en: "New password" },
  passwordMinHint: { ar: "8 أحرف على الأقل", en: "At least 8 characters" },

  department: { ar: "القسم / الدور", en: "Department / floor" },
  approvalStatus: { ar: "حالة الاعتماد", en: "Approval" },
  approve: { ar: "اعتماد", en: "Approve" },
  reject: { ar: "رفض", en: "Reject" },
  ap_pending: { ar: "معلّق", en: "Pending" },
  ap_approved: { ar: "معتمد", en: "Approved" },
  ap_rejected: { ar: "مرفوض", en: "Rejected" },
  ap_deactivated: { ar: "ملغي", en: "Deactivated" },
  archiveAccount: { ar: "أرشفة الحساب", en: "Archive account" },
  archiveAccountConfirm: {
    ar: "سيتم إلغاء هذا الحساب ومنعه من الطلب، مع الاحتفاظ بكل السجل المالي كما هو.",
    en: "This account will be deactivated and blocked from ordering. All financial history stays untouched.",
  },
  showArchivedAccounts: { ar: "عرض الحسابات المؤرشفة", en: "Show archived accounts" },
  hideArchivedAccounts: { ar: "إخفاء الحسابات المؤرشفة", en: "Hide archived accounts" },
  restoreAccount: { ar: "استعادة الحساب", en: "Restore account" },
  lastOrder: { ar: "آخر طلب", en: "Last order" },
  lastPayment: { ar: "آخر دفعة", en: "Last payment" },
  recordPayment: { ar: "تسجيل دفعة", en: "Record payment" },
  closeAccount: { ar: "إقفال الحساب", en: "Close account" },
  closings: { ar: "سجل الإقفالات", en: "Closing history" },
  payments: { ar: "المدفوعات", en: "Payments" },
  ledger: { ar: "كشف الحساب", en: "Ledger" },
  method: { ar: "طريقة الدفع", en: "Method" },
  totalOrders: { ar: "إجمالي الطلبات", en: "Total ordered" },
  totalPaid: { ar: "إجمالي المدفوع", en: "Total paid" },
  closeAccountConfirm: {
    ar: "سيتم تسجيل إقفال للفترة الحالية دون حذف أي عملية سابقة. هل تريد المتابعة؟",
    en: "This records a closing for the current period without deleting any history. Continue?",
  },
  amountSettled: { ar: "المبلغ المسدد", en: "Amount settled" },
  currentStatement: { ar: "كشف الفترة الحالية", en: "Current statement" },
  openingBalance: { ar: "رصيد افتتاحي", en: "Opening balance" },
  voidPayment: { ar: "إلغاء الدفعة", en: "Void payment" },
  voidPaymentConfirm: {
    ar: "سيتم حذف هذه الدفعة نهائيًا وتعديل رصيد العميل فورًا. هل أنت متأكد؟",
    en: "This permanently deletes the payment and updates the balance immediately. Are you sure?",
  },
  cancelRecognizedConfirm: {
    ar: "هذا الطلب مُحتسب بالفعل في المبيعات/رصيد العميل — إلغاؤه سيعكس هذا التأثير فورًا. هل أنت متأكد؟",
    en: "This order is already counted in sales and the customer balance — cancelling reverses that immediately. Are you sure?",
  },
  deleteExpenseConfirm: {
    ar: "سيتم حذف هذا المصروف نهائيًا. هل أنت متأكد؟",
    en: "This expense will be permanently deleted. Are you sure?",
  },
  delete: { ar: "حذف", en: "Delete" },
  period: { ar: "الفترة", en: "Period" },
  closedBy: { ar: "أُقفل بواسطة", en: "Closed by" },

  // expenses
  addExpense: { ar: "إضافة مصروف", en: "Add expense" },
  description: { ar: "الوصف", en: "Description" },
  exp_food: { ar: "مشتريات طعام", en: "Food purchases" },
  exp_supplies: { ar: "مستلزمات", en: "Supplies" },
  exp_utilities: { ar: "مرافق", en: "Utilities" },
  exp_personal: { ar: "شخصية", en: "Personal" },
  exp_other: { ar: "أخرى", en: "Other" },

  // reports
  monthlyClosing: { ar: "الإقفال الشهري", en: "Monthly closing" },
  revenue: { ar: "الإيرادات", en: "Revenue" },
  exportOrders: { ar: "تصدير الطلبات", en: "Export orders" },
  exportCustomers: { ar: "تصدير الحسابات", en: "Export accounts" },
  exportPayments: { ar: "تصدير المدفوعات", en: "Export payments" },
  exportExpenses: { ar: "تصدير المصروفات", en: "Export expenses" },
  exportSummary: { ar: "تصدير الملخص", en: "Export summary" },
  salesByItem: { ar: "المبيعات حسب الصنف", en: "Sales by item" },
  quantitySold: { ar: "الكمية المباعة", en: "Quantity sold" },
  exportItemSales: { ar: "تصدير مبيعات الأصناف", en: "Export item sales" },
  exportMenu: { ar: "تصدير المنيو", en: "Export menu" },
  exportMenuHint: { ar: "تصدير الأقسام والمنتجات بترتيبها للتحقق البصري", en: "Export categories & products with their sort order" },
  csvType: { ar: "النوع", en: "Type" },
  csvCategory: { ar: "قسم", en: "Category" },
  csvProduct: { ar: "منتج", en: "Product" },
  csvParentCategory: { ar: "القسم", en: "Parent category" },
  csvCompositeOrder: { ar: "ترتيب مركب", en: "Composite order" },
  csvAvailable: { ar: "متاح", en: "Available" },
  csvArchived: { ar: "مؤرشف", en: "Archived" },
  csvActive: { ar: "فعال", en: "Active" },
  csvInactive: { ar: "غير فعال", en: "Inactive" },
  searchItems: { ar: "بحث عن صنف", en: "Search item" },


  // settings
  restaurantName: { ar: "اسم المطعم", en: "Restaurant name" },
  logo: { ar: "الشعار", en: "Logo" },
  favicon: { ar: "أيقونة الموقع", en: "Favicon" },
  changeImage: { ar: "تغيير الصورة", en: "Change image" },
  removeImage: { ar: "إزالة", en: "Remove" },
  imageHint: { ar: "PNG أو JPG، يفضل مربع الشكل", en: "PNG or JPG, square works best" },
  faviconHint: { ar: "صورة مربعة صغيرة (32×32 أو 64×64)", en: "Small square image (32×32 or 64×64)" },
  increaseQty: { ar: "زيادة الكمية", en: "Increase quantity" },
  decreaseQty: { ar: "تقليل الكمية", en: "Decrease quantity" },
  removeItem: { ar: "إزالة الصنف", en: "Remove item" },
  brandColors: { ar: "ألوان الهوية", en: "Brand colors" },
  primaryColor: { ar: "اللون الأساسي", en: "Primary color" },
  accentColor: { ar: "اللون الثانوي", en: "Accent color" },
  currency: { ar: "العملة", en: "Currency" },
  currencyCode: { ar: "كود العملة", en: "Currency code" },
  currencySymbolAr: { ar: "رمز العملة (عربي)", en: "Currency symbol (Arabic)" },
  currencySymbolEn: { ar: "رمز العملة (إنجليزي)", en: "Currency symbol (English)" },
  contactPhone: { ar: "هاتف التواصل", en: "Contact phone" },
  contactEmail: { ar: "بريد التواصل", en: "Contact email" },
  address: { ar: "العنوان", en: "Address" },
  publicLink: { ar: "رابط الطلب العام / QR", en: "Public ordering link / QR" },
  orderingStatus: { ar: "استقبال الطلبات", en: "Accepting orders" },
  orderingOpen: { ar: "مفتوح — يمكن للعملاء الطلب", en: "Open — customers can order" },
  orderingClosed: { ar: "مغلق — لا يمكن استقبال طلبات", en: "Closed — no new orders" },
  orderingClosedMessage: {
    ar: "أهلاً بيك في مطعم Crunchy 🌸\n\nالمطعم مغلق حالياً\n\nوسنكون في إستقبال طلباتكم بكل شوق غداً 🌸\n\nنتمنى لكم أوقاتاً سعيدة",
    en: "أهلاً بيك في مطعم Crunchy 🌸\n\nالمطعم مغلق حالياً\n\nوسنكون في إستقبال طلباتكم بكل شوق غداً 🌸\n\nنتمنى لكم أوقاتاً سعيدة",
  },
  saved: { ar: "تم الحفظ", en: "Saved" },
  adminOnly: { ar: "هذه الصفحة للإدارة فقط", en: "This area is for admins only" },

  // integrations / sheets sync
  integrations: { ar: "الربط والتكاملات", en: "Integrations" },
  staff: { ar: "الموظفين", en: "Staff" },
  activityLog: { ar: "سجل العمليات", en: "Activity Log" },
  googleSheetsSync: { ar: "مزامنة Google Sheets", en: "Google Sheets sync" },
  serviceAccountKey: { ar: "مفتاح حساب الخدمة", en: "Service account key" },
  spreadsheetId: { ar: "معرّف جدول البيانات", en: "Spreadsheet ID" },
  configured: { ar: "مضبوط", en: "Configured" },
  missing: { ar: "غير مضبوط", en: "Missing" },
  syncHint: {
    ar: "تتم مزامنة الطلبات والأصناف والعملاء والمدفوعات والمصروفات والإقفالات تلقائيًا عند كل إضافة أو تعديل.",
    en: "Orders, order items, customers, payments, expenses and closings are pushed automatically on every insert or update.",
  },
  failedSyncs: { ar: "عمليات فشلت", en: "Failed syncs" },
  recentSyncs: { ar: "آخر عمليات المزامنة", en: "Recent syncs" },
  allSynced: { ar: "كل البيانات متزامنة", en: "Everything is in sync" },
  resyncAll: { ar: "إعادة مزامنة الكل", en: "Re-sync everything" },
  syncSucceeded: { ar: "تمت المزامنة", en: "Synced" },
  failed: { ar: "فشل", en: "Failed" },

  // live order alerts
  newOrderAlert: { ar: "طلب جديد", en: "New order" },
  viewOrder: { ar: "عرض الطلب", en: "View order" },
  dismissAll: { ar: "إخفاء الكل", en: "Dismiss all" },
  muteAlerts: { ar: "إيقاف صوت التنبيهات", en: "Mute alerts" },
  unmuteAlerts: { ar: "تشغيل صوت التنبيهات", en: "Unmute alerts" },
  dayMode: { ar: "الوضع النهاري", en: "Day mode" },
  nightMode: { ar: "الوضع الليلي", en: "Night mode" },
  enableSoundAlerts: { ar: "تفعيل تنبيه الصوت", en: "Enable order sound alerts" },
};



type Ctx = { lang: Lang; dir: "rtl" | "ltr"; t: (k: keyof typeof dict) => string; setLang: (l: Lang) => void };

const LangContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("krunshy_lang") : null;
    if (stored === "en" || stored === "ar") setLangState(stored);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") window.localStorage.setItem("krunshy_lang", l);
  }, []);

  const t = useCallback((k: keyof typeof dict) => dict[k]?.[lang] ?? String(k), [lang]);

  const value = useMemo(
    () => ({ lang, dir: (lang === "ar" ? "rtl" : "ltr") as "rtl" | "ltr", t, setLang }),
    [lang, t, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useI18n must be used inside LanguageProvider");
  return ctx;
}

export function pickName(lang: Lang, ar: string | null | undefined, en: string | null | undefined) {
  return (lang === "ar" ? ar || en : en || ar) ?? "";
}
