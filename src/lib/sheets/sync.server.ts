// Server-only: one-way sync of business events into a multi-tab Arabic Google Sheet.
// Row identity is claimed in Postgres (sheet_sync_state) BEFORE touching the Sheets
// API, so concurrent events for the same record can never append two rows.
import { getGoogleAccessToken } from "./google-auth.server";

const API = "https://sheets.googleapis.com/v4/spreadsheets";
export const TIMEZONE = "Africa/Cairo";

export type SyncTable =
  | "orders"
  | "order_items"
  | "profiles"
  | "payments"
  | "expenses"
  | "account_closings"
  | "audit_logs";

export const SYNC_TABLES: SyncTable[] = [
  "orders",
  "order_items",
  "profiles",
  "payments",
  "expenses",
  "account_closings",
  "audit_logs",
];

export const TABS = {
  cash: "أوردرات الزوار (كاش)",
  account: "أوردرات العملاء (آجل)",
  customers: "حسابات العملاء والمدفوعات",
  expenses: "المصروفات",
  closing: "التقفيل اليومي",
  audit: "سجل عمليات الأدمن",
} as const;

export type TabName = (typeof TABS)[keyof typeof TABS];

export const TAB_HEADERS: Record<TabName, string[]> = {
  [TABS.cash]: [
    "مفتاح المزامنة",
    "التاريخ والوقت",
    "نوع الصف",
    "رقم الطلب",
    "الحالة",
    "حالة الدفع",
    "الوصف",
    "المبلغ (جنيه)",
  ],
  [TABS.account]: [
    "مفتاح المزامنة",
    "التاريخ والوقت",
    "نوع الصف",
    "رقم الطلب",
    "اسم العميل",
    "الحالة",
    "حالة الدفع",
    "الوصف",
    "المبلغ (جنيه)",
  ],
  [TABS.customers]: [
    "مفتاح المزامنة",
    "التاريخ والوقت",
    "نوع الحدث",
    "اسم العميل",
    "الوصف",
    "المبلغ (جنيه)",
    "الرصيد بعد الحدث (جنيه)",
  ],
  [TABS.expenses]: [
    "مفتاح المزامنة",
    "التاريخ",
    "الفئة",
    "الوصف",
    "المبلغ (جنيه)",
    "ملاحظات",
  ],
  [TABS.closing]: [
    "مفتاح المزامنة",
    "التاريخ",
    "إجمالي مبيعات الكاش (جنيه)",
    "إجمالي التحصيل من حسابات الآجل (جنيه)",
    "إجمالي المصروفات (جنيه)",
    "صافي الربح التقديري (جنيه)",
    "إجمالي الأرصدة المستحقة على العملاء (جنيه)",
  ],
  [TABS.audit]: ["مفتاح المزامنة", "التاريخ والوقت", "نوع الإجراء", "التفاصيل", "بواسطة"],
};

const ORDER_STATUS_AR: Record<string, string> = {
  pending: "قيد الانتظار",
  confirmed: "مؤكد",
  preparing: "قيد التحضير",
  ready: "جاهز",
  completed: "مكتمل",
  cancelled: "ملغي",
};

const PAYMENT_STATUS_AR: Record<string, string> = {
  paid: "مدفوع",
  unpaid: "غير مدفوع",
};

const APPROVAL_AR: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
};

const METHOD_AR: Record<string, string> = {
  cash: "نقدي",
  transfer: "تحويل",
  card: "بطاقة",
  other: "أخرى",
};

const ACTION_AR: Record<string, string> = {
  create: "إضافة",
  update: "تعديل",
  archive: "أرشفة",
  unarchive: "استرجاع",
  delete: "حذف",
  approval_approved: "الموافقة على حساب موظف",
  approval_rejected: "رفض حساب موظف",
  approval_pending: "إرجاع حساب موظف للمراجعة",
  record_payment: "تسجيل دفعة",
  close_account: "تقفيل حساب عميل",
  mark_paid: "تعليم طلب كمدفوع",
};

const ENTITY_AR: Record<string, string> = {
  product: "صنف في القائمة",
  products: "صنف في القائمة",
  category: "قسم في القائمة",
  categories: "قسم في القائمة",
  order: "طلب",
  orders: "طلب",
  profile: "حساب موظف",
  profiles: "حساب موظف",
  payment: "دفعة",
  payments: "دفعة",
  expense: "مصروف",
  expenses: "مصروف",
  settings: "إعدادات المطعم",
  restaurant_settings: "إعدادات المطعم",
  account_closing: "تقفيل حساب",
  account_closings: "تقفيل حساب",
};

function ar(map: Record<string, string>, value: unknown, fallback = ""): string {
  const key = String(value ?? "");
  return map[key] ?? (fallback || key);
}

function spreadsheetId(): string {
  const id = process.env["GOOGLE_SHEETS_SPREADSHEET_ID"];
  if (!id) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not configured");
  return id;
}

/** Removes anything that could resemble credential material from an error string. */
export function sanitizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg
    .replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/g, "[redacted key]")
    .replace(/ya29\.[A-Za-z0-9._-]+/g, "[redacted token]")
    .replace(/"private_key"\s*:\s*"[^"]*"/g, '"private_key":"[redacted]"')
    .slice(0, 500);
}

async function sheetsFetch(path: string, init?: RequestInit) {
  const token = await getGoogleAccessToken();
  const res = await fetch(`${API}/${spreadsheetId()}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

function colLetter(count: number): string {
  return String.fromCharCode(64 + count); // all tabs are <= 26 columns
}

const ensured = new Set<string>();

/** Creates the tab when missing and makes sure the Arabic header row is present. */
async function ensureTab(tab: TabName) {
  if (ensured.has(tab)) return;
  const headers = TAB_HEADERS[tab];
  const last = colLetter(headers.length);
  const meta = (await sheetsFetch("?fields=sheets.properties.title")) as {
    sheets?: { properties?: { title?: string } }[];
  };
  const exists = meta.sheets?.some((s) => s.properties?.title === tab);
  if (!exists) {
    await sheetsFetch(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab } } }] }),
    });
  }
  const head = (await sheetsFetch(`/values/${encodeURIComponent(tab)}!A1:${last}1`)) as {
    values?: string[][];
  };
  const current = head.values?.[0] ?? [];
  if (!headers.every((h, i) => current[i] === h)) {
    await sheetsFetch(`/values/${encodeURIComponent(tab)}!A1:${last}1?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: [headers] }),
    });
  }
  ensured.add(tab);
}

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** Parses "'Tab'!A12:H12" -> 12 */
function rowFromRange(range: string | undefined): number | null {
  const m = /![A-Z]+(\d+):/.exec(range ?? "");
  return m ? Number(m[1]) : null;
}

async function findRowIndex(tab: TabName, syncKey: string): Promise<number | null> {
  const res = (await sheetsFetch(`/values/${encodeURIComponent(tab)}!A:A`)) as {
    values?: string[][];
  };
  const rows = res.values ?? [];
  for (let i = 0; i < rows.length; i++) if (rows[i]?.[0] === syncKey) return i + 1;
  return null;
}

async function updateRow(tab: TabName, rowIndex: number, values: (string | number)[]) {
  const last = colLetter(TAB_HEADERS[tab].length);
  await sheetsFetch(
    `/values/${encodeURIComponent(tab)}!A${rowIndex}:${last}${rowIndex}?valueInputOption=RAW`,
    { method: "PUT", body: JSON.stringify({ values: [values] }) },
  );
}

/**
 * Writes exactly one physical row per sync key.
 * The right to APPEND is claimed atomically in Postgres; losers of the race wait
 * for the winner to record the row number and then update that row instead.
 */
async function writeRow(
  admin: Admin,
  tab: TabName,
  syncKey: string,
  values: (string | number)[],
) {
  await ensureTab(tab);

  const { data: claimed } = await admin
    .from("sheet_sync_state")
    .upsert({ sync_key: syncKey, tab }, { onConflict: "sync_key", ignoreDuplicates: true })
    .select("id");

  const won = (claimed ?? []).length > 0;

  if (won) {
    const last = colLetter(TAB_HEADERS[tab].length);
    const res = (await sheetsFetch(
      `/values/${encodeURIComponent(tab)}!A1:${last}1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ values: [values] }) },
    )) as { updates?: { updatedRange?: string } };
    const row = rowFromRange(res.updates?.updatedRange) ?? (await findRowIndex(tab, syncKey));
    if (row) await admin.from("sheet_sync_state").update({ row_number: row }).eq("sync_key", syncKey);
    return;
  }

  // Lost the race: wait briefly for the winner to publish the row number.
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data } = await admin
      .from("sheet_sync_state")
      .select("row_number")
      .eq("sync_key", syncKey)
      .maybeSingle();
    if (data?.row_number) {
      await updateRow(tab, data.row_number, values);
      return;
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  const row = await findRowIndex(tab, syncKey);
  if (row) {
    await updateRow(tab, row, values);
    await admin.from("sheet_sync_state").update({ row_number: row }).eq("sync_key", syncKey);
  }
}

function dt(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

function num(value: unknown): number | "" {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? n : "";
}

async function customerName(admin: Admin, id: string | null | undefined): Promise<string> {
  if (!id) return "زائر";
  const { data } = await admin
    .from("profiles")
    .select("display_name, full_name, email")
    .eq("id", id)
    .maybeSingle();
  return data?.display_name || data?.full_name || data?.email || "غير معروف";
}

async function balanceOf(admin: Admin, id: string): Promise<number | ""> {
  const { data } = await admin.rpc("customer_balance", { _customer_id: id });
  return num(data);
}

function auditDetails(
  action: string,
  entity: string,
  previous: Record<string, unknown> | null,
  next: Record<string, unknown> | null,
): string {
  const name =
    (next?.["name_ar"] as string) ||
    (next?.["name_en"] as string) ||
    (next?.["description"] as string) ||
    "";
  const entityAr = ar(ENTITY_AR, entity, String(entity ?? ""));
  const before = previous?.["price"];
  const after = next?.["price"];
  if (action === "update" && after !== undefined && before !== undefined && before !== after) {
    return `تغيير سعر: ${name} من ${String(before)} إلى ${String(after)} جنيه`;
  }
  switch (action) {
    case "create":
      return `تمت إضافة ${entityAr}${name ? `: ${name}` : ""}`;
    case "update":
      return `تم تعديل ${entityAr}${name ? `: ${name}` : ""}`;
    case "archive":
      return `تمت أرشفة ${entityAr}${name ? `: ${name}` : ""}`;
    case "unarchive":
      return `تم استرجاع ${entityAr}${name ? `: ${name}` : ""}`;
    case "delete":
      return `تم حذف ${entityAr}`;
    case "approval_approved":
      return "تمت الموافقة على حساب موظف";
    case "approval_rejected":
      return "تم رفض حساب موظف";
    case "approval_pending":
      return "تم إرجاع حساب موظف لقيد المراجعة";
    case "record_payment":
      return `تم تسجيل دفعة بمبلغ ${String(next?.["amount"] ?? "")} جنيه`;
    case "close_account":
      return "تم تقفيل حساب عميل";
    case "mark_paid":
      return "تم تعليم طلب كمدفوع";
    default:
      return `${ar(ACTION_AR, action, String(action))} على ${entityAr}`;
  }
}

type Plan = { tab: TabName; values: (string | number)[] } | null;

/** Builds the destination tab + row for a record, or null when it no longer exists. */
async function buildPlan(admin: Admin, table: SyncTable, recordId: string): Promise<Plan> {
  const key = `${table}:${recordId}`;
  switch (table) {
    case "orders": {
      const { data } = await admin.from("orders").select("*").eq("id", recordId).maybeSingle();
      if (!data) return null;
      const { count } = await admin
        .from("order_items")
        .select("id", { count: "exact", head: true })
        .eq("order_id", data.id);
      const isAccount = data.order_type === "ACCOUNT";
      const name = isAccount
        ? await customerName(admin, data.customer_id)
        : data.visitor_name || "زائر";
      const base = [
        key,
        dt(data.created_at),
        "طلب",
        `#${data.order_number}`,
      ];
      const tail = [
        ar(ORDER_STATUS_AR, data.status),
        ar(PAYMENT_STATUS_AR, data.payment_status),
        `طلب رقم #${data.order_number} — عدد الأصناف: ${count ?? 0}`,
        num(data.total),
      ];
      return isAccount
        ? { tab: TABS.account, values: [...base, name, ...tail] }
        : { tab: TABS.cash, values: [...base, ...tail] };
    }
    case "order_items": {
      const { data } = await admin.from("order_items").select("*").eq("id", recordId).maybeSingle();
      if (!data) return null;
      const { data: order } = await admin
        .from("orders")
        .select("order_number, order_type, status, payment_status, customer_id, visitor_name, created_at")
        .eq("id", data.order_id)
        .maybeSingle();
      if (!order) return null;
      const isAccount = order.order_type === "ACCOUNT";
      const name = isAccount
        ? await customerName(admin, order.customer_id)
        : order.visitor_name || "زائر";
      const base = [key, dt(data.created_at), "صنف", `#${order.order_number}`];
      const tail = [
        ar(ORDER_STATUS_AR, order.status),
        ar(PAYMENT_STATUS_AR, order.payment_status),
        `${data.product_name_snapshot} × ${data.quantity} (سعر الوحدة ${data.unit_price_snapshot} جنيه)`,
        num(data.line_total),
      ];
      return isAccount
        ? { tab: TABS.account, values: [...base, name, ...tail] }
        : { tab: TABS.cash, values: [...base, ...tail] };
    }
    case "profiles": {
      const { data } = await admin.from("profiles").select("*").eq("id", recordId).maybeSingle();
      if (!data) return null;
      const balance = await balanceOf(admin, recordId);
      const name = data.display_name || data.full_name || data.email;
      return {
        tab: TABS.customers,
        values: [
          key,
          dt(data.updated_at ?? data.created_at),
          "بيانات عميل",
          name,
          `حالة الحساب: ${ar(APPROVAL_AR, data.approval_status)}${data.department ? ` — القسم: ${data.department}` : ""}`,
          "",
          balance,
        ],
      };
    }
    case "payments": {
      const { data } = await admin.from("payments").select("*").eq("id", recordId).maybeSingle();
      if (!data) return null;
      const name = await customerName(admin, data.customer_id);
      const balance = await balanceOf(admin, data.customer_id);
      return {
        tab: TABS.customers,
        values: [
          key,
          dt(data.created_at),
          "دفعة",
          name,
          `دفعة بمبلغ ${data.amount} جنيه — طريقة الدفع: ${ar(METHOD_AR, data.method)} — بتاريخ ${data.paid_on}${data.notes ? ` — ${data.notes}` : ""}`,
          num(data.amount),
          balance,
        ],
      };
    }
    case "account_closings": {
      const { data } = await admin
        .from("account_closings")
        .select("*")
        .eq("id", recordId)
        .maybeSingle();
      if (!data) return null;
      const name = await customerName(admin, data.customer_id);
      return {
        tab: TABS.customers,
        values: [
          key,
          dt(data.closed_at),
          "تقفيل حساب",
          name,
          `تقفيل حساب عن الفترة ${data.period_start ?? "—"} حتى ${data.period_end}${data.note ? ` — ${data.note}` : ""}`,
          num(data.amount_settled),
          num(data.outstanding_after),
        ],
      };
    }
    case "expenses": {
      const { data } = await admin.from("expenses").select("*").eq("id", recordId).maybeSingle();
      if (!data) return null;
      return {
        tab: TABS.expenses,
        values: [key, data.spent_on, data.category, data.description, num(data.amount), data.notes ?? ""],
      };
    }
    case "audit_logs": {
      const { data } = await admin.from("audit_logs").select("*").eq("id", recordId).maybeSingle();
      if (!data) return null;
      const previous = (data.previous_value ?? null) as Record<string, unknown> | null;
      const next = (data.new_value ?? null) as Record<string, unknown> | null;
      const actor = data.actor_id ? await customerName(admin, data.actor_id) : "النظام";
      return {
        tab: TABS.audit,
        values: [
          key,
          dt(data.created_at),
          ar(ACTION_AR, data.action, String(data.action)),
          auditDetails(data.action, data.entity, previous, next),
          actor,
        ],
      };
    }
  }
}

async function logAttempt(
  admin: Admin,
  table: string,
  recordId: string,
  status: "success" | "failed",
  errorMessage: string | null,
) {
  const { data: existing } = await admin
    .from("sync_logs")
    .select("id, retry_count")
    .eq("table_name", table)
    .eq("record_id", recordId)
    .maybeSingle();
  const payload = {
    table_name: table,
    record_id: recordId,
    status,
    error_message: errorMessage,
    attempted_at: new Date().toISOString(),
    retry_count: existing ? existing.retry_count + 1 : 0,
  };
  if (existing) await admin.from("sync_logs").update(payload).eq("id", existing.id);
  else await admin.from("sync_logs").insert(payload);
}

// Serial queue: rapid successive writes are processed one at a time with a small
// gap so the Sheets API quota isn't hammered during high order volume.
let queue: Promise<unknown> = Promise.resolve();

export function enqueueSync(table: SyncTable, recordId: string): Promise<{ ok: boolean }> {
  const run = queue.then(async () => {
    const result = await syncRecord(table, recordId);
    await new Promise((r) => setTimeout(r, 150));
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function syncRecord(
  table: SyncTable,
  recordId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    const plan = await buildPlan(supabaseAdmin, table, recordId);
    if (!plan) return { ok: true };
    await writeRow(supabaseAdmin, plan.tab, `${table}:${recordId}`, plan.values);
    await logAttempt(supabaseAdmin, table, recordId, "success", null);
    return { ok: true };
  } catch (err) {
    const message = sanitizeError(err);
    console.error(`[sheets-sync] ${table}/${recordId} failed: ${message}`);
    try {
      await logAttempt(supabaseAdmin, table, recordId, "failed", message);
    } catch (logErr) {
      console.error("[sheets-sync] logging failed", sanitizeError(logErr));
    }
    return { ok: false, error: message };
  }
}

/** Aggregates one full Cairo day and writes/updates its single closing row. */
export async function writeDailyClosing(date: string): Promise<{ ok: boolean; error?: string }> {
  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  try {
    const from = `${date}T00:00:00+03:00`;
    const to = `${date}T23:59:59.999+03:00`;

    const { data: cashOrders } = await admin
      .from("orders")
      .select("total")
      .eq("order_type", "CASH")
      .eq("payment_status", "paid")
      .neq("status", "cancelled")
      .gte("created_at", from)
      .lte("created_at", to);
    const cash = (cashOrders ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0);

    const { data: payments } = await admin.from("payments").select("amount").eq("paid_on", date);
    const collected = (payments ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);

    const { data: expenses } = await admin.from("expenses").select("amount").eq("spent_on", date);
    const spent = (expenses ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);

    const { data: accountOrders } = await admin
      .from("orders")
      .select("total")
      .eq("order_type", "ACCOUNT")
      .neq("status", "cancelled");
    const ordered = (accountOrders ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0);
    const { data: allPayments } = await admin.from("payments").select("amount");
    const paid = (allPayments ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const outstanding = ordered - paid;

    const round = (n: number) => Math.round(n * 100) / 100;
    await writeRow(admin, TABS.closing, `daily_closing:${date}`, [
      `daily_closing:${date}`,
      date,
      round(cash),
      round(collected),
      round(spent),
      round(cash + collected - spent),
      round(outstanding),
    ]);
    await logAttempt(admin, "daily_closing", date, "success", null);
    return { ok: true };
  } catch (err) {
    const message = sanitizeError(err);
    console.error(`[sheets-sync] daily closing ${date} failed: ${message}`);
    return { ok: false, error: message };
  }
}
