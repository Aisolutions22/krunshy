// Server-only: one-way sync of every business event and admin action into a
// single unified Google Sheets activity log tab ("Sheet1").
import { getGoogleAccessToken } from "./google-auth.server";

const API = "https://sheets.googleapis.com/v4/spreadsheets";

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

export const SHEET_TAB = "Sheet1";

export const SHEET_HEADERS = [
  "Sync Key",
  "Timestamp",
  "Event Type",
  "Reference",
  "Actor / Customer",
  "Description",
  "Amount (EGP)",
  "Status / Extra Info",
];

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

/** Ensures the single tab exists and carries the unified header row. */
async function ensureSheet() {
  const meta = (await sheetsFetch("?fields=sheets.properties.title")) as {
    sheets?: { properties?: { title?: string } }[];
  };
  const exists = meta.sheets?.some((s) => s.properties?.title === SHEET_TAB);
  if (!exists) {
    await sheetsFetch(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: SHEET_TAB } } }] }),
    });
  }
  const head = (await sheetsFetch(`/values/${encodeURIComponent(SHEET_TAB)}!A1:H1`)) as {
    values?: string[][];
  };
  const current = head.values?.[0] ?? [];
  const ok = SHEET_HEADERS.every((h, i) => current[i] === h);
  if (!ok) {
    await sheetsFetch(`/values/${encodeURIComponent(SHEET_TAB)}!A1:H1?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: [SHEET_HEADERS] }),
    });
  }
}

async function findRowIndex(syncKey: string): Promise<number | null> {
  const res = (await sheetsFetch(`/values/${encodeURIComponent(SHEET_TAB)}!A:A`)) as {
    values?: string[][];
  };
  const rows = res.values ?? [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]?.[0] === syncKey) return i + 1; // 1-based sheet row
  }
  return null;
}

async function upsertRow(values: (string | number)[]) {
  await ensureSheet();
  const syncKey = String(values[0]);
  const rowIndex = await findRowIndex(syncKey);
  if (rowIndex) {
    await sheetsFetch(
      `/values/${encodeURIComponent(SHEET_TAB)}!A${rowIndex}:H${rowIndex}?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ values: [values] }) },
    );
  } else {
    await sheetsFetch(
      `/values/${encodeURIComponent(SHEET_TAB)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ values: [values] }) },
    );
  }
}

function d(value: string | null | undefined): string {
  return value ? new Date(value).toISOString().replace("T", " ").slice(0, 16) : "";
}

function num(value: unknown): number | "" {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? n : "";
}

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function customerName(admin: Admin, id: string | null | undefined): Promise<string> {
  if (!id) return "Visitor";
  const { data } = await admin
    .from("profiles")
    .select("display_name, full_name, email")
    .eq("id", id)
    .maybeSingle();
  return data?.display_name || data?.full_name || data?.email || "Visitor";
}

async function orderNumber(admin: Admin, id: string | null | undefined): Promise<string> {
  if (!id) return "";
  const { data } = await admin.from("orders").select("order_number").eq("id", id).maybeSingle();
  return data ? `#${data.order_number}` : "";
}

function label(value: unknown): string {
  return String(value ?? "").replace(/_/g, " ");
}

/** Builds a human summary for an admin action row. */
function auditDescription(
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
  switch (action) {
    case "create":
      return `${label(entity)} created${name ? `: ${name}` : ""}`;
    case "update": {
      const before = previous?.["price"];
      const after = next?.["price"];
      if (after !== undefined && before !== undefined && before !== after) {
        return `Price changed: ${name} ${String(before)} → ${String(after)} EGP`;
      }
      return `${label(entity)} updated${name ? `: ${name}` : ""}`;
    }
    case "archive":
      return `${label(entity)} archived${name ? `: ${name}` : ""}`;
    case "unarchive":
      return `${label(entity)} restored${name ? `: ${name}` : ""}`;
    case "delete":
      return `${label(entity)} deleted`;
    case "approval_approved":
      return "Employee account approved";
    case "approval_rejected":
      return "Employee account rejected";
    case "approval_pending":
      return "Employee account set back to pending";
    case "record_payment":
      return `Payment of ${String(next?.["amount"] ?? "")} EGP recorded`;
    case "close_account":
      return "Account closed / settled";
    case "mark_paid":
      return "Order marked as paid";
    default:
      return `${label(action)} on ${label(entity)}`;
  }
}

/** Builds the unified sheet row for a record, or null when the record no longer exists. */
async function buildRow(
  admin: Admin,
  table: SyncTable,
  recordId: string,
): Promise<(string | number)[] | null> {
  const key = `${table}:${recordId}`;
  switch (table) {
    case "orders": {
      const { data } = await admin.from("orders").select("*").eq("id", recordId).maybeSingle();
      if (!data) return null;
      const name = data.customer_id
        ? await customerName(admin, data.customer_id)
        : data.visitor_name || "Visitor";
      const { count } = await admin
        .from("order_items")
        .select("id", { count: "exact", head: true })
        .eq("order_id", data.id);
      return [
        key,
        d(data.created_at),
        "Order",
        `#${data.order_number}`,
        name,
        `Order #${data.order_number} placed — ${data.order_type} — ${count ?? 0} items`,
        num(data.total),
        `${label(data.status)} / ${label(data.payment_status)}`,
      ];
    }
    case "order_items": {
      const { data } = await admin.from("order_items").select("*").eq("id", recordId).maybeSingle();
      if (!data) return null;
      const ref = await orderNumber(admin, data.order_id);
      return [
        key,
        d(data.created_at),
        "Order Item",
        ref,
        "",
        `${data.product_name_snapshot} × ${data.quantity} @ ${data.unit_price_snapshot} EGP`,
        num(data.line_total),
        `Order ${ref}`,
      ];
    }
    case "profiles": {
      const { data } = await admin.from("profiles").select("*").eq("id", recordId).maybeSingle();
      if (!data) return null;
      const { data: balance } = await admin.rpc("customer_balance", { _customer_id: recordId });
      const name = data.display_name || data.full_name || data.email;
      return [
        key,
        d(data.updated_at ?? data.created_at),
        "Customer",
        data.email,
        name,
        `Customer ${name} — ${label(data.approval_status)}`,
        num(balance),
        `Balance ${num(balance)} EGP`,
      ];
    }
    case "payments": {
      const { data } = await admin.from("payments").select("*").eq("id", recordId).maybeSingle();
      if (!data) return null;
      const name = await customerName(admin, data.customer_id);
      const ref = await orderNumber(admin, data.order_id);
      return [
        key,
        d(data.created_at),
        "Payment",
        data.id.slice(0, 8),
        name,
        `Payment of ${data.amount} EGP recorded for ${name}${ref ? ` (order ${ref})` : ""}`,
        num(data.amount),
        `${data.method} · ${data.paid_on}${data.notes ? ` · ${data.notes}` : ""}`,
      ];
    }
    case "expenses": {
      const { data } = await admin.from("expenses").select("*").eq("id", recordId).maybeSingle();
      if (!data) return null;
      return [
        key,
        d(data.created_at),
        "Expense",
        data.id.slice(0, 8),
        data.created_by ? await customerName(admin, data.created_by) : "",
        `Expense: ${data.description} (${data.category})`,
        num(data.amount),
        `${data.spent_on}${data.notes ? ` · ${data.notes}` : ""}`,
      ];
    }
    case "account_closings": {
      const { data } = await admin
        .from("account_closings")
        .select("*")
        .eq("id", recordId)
        .maybeSingle();
      if (!data) return null;
      const name = await customerName(admin, data.customer_id);
      return [
        key,
        d(data.closed_at),
        "Account Closing",
        data.id.slice(0, 8),
        name,
        `Account closed for ${name} (${data.period_start ?? ""} → ${data.period_end})`,
        num(data.amount_settled),
        `Outstanding after: ${num(data.outstanding_after)} EGP · by ${await customerName(admin, data.closed_by)}`,
      ];
    }
    case "audit_logs": {
      const { data } = await admin.from("audit_logs").select("*").eq("id", recordId).maybeSingle();
      if (!data) return null;
      const previous = (data.previous_value ?? null) as Record<string, unknown> | null;
      const next = (data.new_value ?? null) as Record<string, unknown> | null;
      const actor = data.actor_id ? await customerName(admin, data.actor_id) : "System";
      const amount = next?.["amount"] ?? next?.["price"];
      return [
        key,
        d(data.created_at),
        "Admin Action",
        data.entity_id ? String(data.entity_id).slice(0, 8) : label(data.entity),
        actor,
        auditDescription(data.action, data.entity, previous, next),
        num(amount),
        `${label(data.action)} · ${label(data.entity)}`,
      ];
    }
  }
}

async function logAttempt(
  admin: Admin,
  table: SyncTable,
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

export async function syncRecord(table: SyncTable, recordId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    const row = await buildRow(supabaseAdmin, table, recordId);
    if (!row) return { ok: true };
    await upsertRow(row);
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
