// Server-only: one-way sync of business records into Google Sheets.
import { getGoogleAccessToken } from "./google-auth.server";

const API = "https://sheets.googleapis.com/v4/spreadsheets";

export type SyncTable =
  | "orders"
  | "order_items"
  | "profiles"
  | "payments"
  | "expenses"
  | "account_closings";

export const SYNC_TABLES: SyncTable[] = [
  "orders",
  "order_items",
  "profiles",
  "payments",
  "expenses",
  "account_closings",
];

type TabSpec = { tab: string; headers: string[] };

export const TABS: Record<SyncTable, TabSpec> = {
  orders: {
    tab: "Orders",
    headers: ["Record ID", "Order #", "Order Date", "Type", "Customer Name", "Status", "Payment Status", "Total (EGP)"],
  },
  order_items: {
    tab: "Order Items",
    headers: ["Record ID", "Order #", "Product Name", "Unit Price (EGP)", "Quantity", "Line Total (EGP)"],
  },
  profiles: {
    tab: "Customers",
    headers: ["Record ID", "Display Name", "Email", "Approval Status", "Current Balance (EGP)", "Last Order Date", "Last Payment Date"],
  },
  payments: {
    tab: "Payments",
    headers: ["Record ID", "Payment ID", "Customer Name", "Order #", "Amount (EGP)", "Method", "Payment Date", "Note"],
  },
  expenses: {
    tab: "Expenses",
    headers: ["Record ID", "Date", "Category", "Description", "Amount (EGP)", "Note"],
  },
  account_closings: {
    tab: "Monthly Closings",
    headers: ["Record ID", "Customer Name", "Period Start", "Period End", "Amount Settled (EGP)", "Outstanding After (EGP)", "Closed By", "Closed Date"],
  },
};

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

async function ensureTab(spec: TabSpec) {
  const meta = (await sheetsFetch("?fields=sheets.properties.title")) as {
    sheets?: { properties?: { title?: string } }[];
  };
  const exists = meta.sheets?.some((s) => s.properties?.title === spec.tab);
  if (exists) return;
  await sheetsFetch(":batchUpdate", {
    method: "POST",
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: spec.tab } } }] }),
  });
  await sheetsFetch(
    `/values/${encodeURIComponent(spec.tab)}!A1?valueInputOption=RAW`,
    { method: "PUT", body: JSON.stringify({ values: [spec.headers] }) },
  );
}

async function findRowIndex(tab: string, recordId: string): Promise<number | null> {
  const res = (await sheetsFetch(`/values/${encodeURIComponent(tab)}!A:A`)) as {
    values?: string[][];
  };
  const rows = res.values ?? [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]?.[0] === recordId) return i + 1; // 1-based sheet row
  }
  return null;
}

async function upsertRow(spec: TabSpec, values: (string | number)[]) {
  await ensureTab(spec);
  const recordId = String(values[0]);
  const rowIndex = await findRowIndex(spec.tab, recordId);
  if (rowIndex) {
    await sheetsFetch(
      `/values/${encodeURIComponent(spec.tab)}!A${rowIndex}?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ values: [values] }) },
    );
  } else {
    await sheetsFetch(
      `/values/${encodeURIComponent(spec.tab)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ values: [values] }) },
    );
  }
}

function d(value: string | null | undefined): string {
  return value ? new Date(value).toISOString().replace("T", " ").slice(0, 16) : "";
}

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
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
  return data ? String(data.order_number) : "";
}

/** Builds the sheet row for a record, or null when the record no longer exists. */
async function buildRow(
  admin: Admin,
  table: SyncTable,
  recordId: string,
): Promise<(string | number)[] | null> {
  switch (table) {
    case "orders": {
      const { data } = await admin.from("orders").select("*").eq("id", recordId).maybeSingle();
      if (!data) return null;
      const name = data.customer_id
        ? await customerName(admin, data.customer_id)
        : data.visitor_name || "Visitor";
      return [
        data.id,
        String(data.order_number),
        d(data.created_at),
        data.order_type,
        name,
        data.status,
        data.payment_status,
        num(data.total),
      ];
    }
    case "order_items": {
      const { data } = await admin.from("order_items").select("*").eq("id", recordId).maybeSingle();
      if (!data) return null;
      return [
        data.id,
        await orderNumber(admin, data.order_id),
        data.product_name_snapshot,
        num(data.unit_price_snapshot),
        data.quantity,
        num(data.line_total),
      ];
    }
    case "profiles": {
      const { data } = await admin.from("profiles").select("*").eq("id", recordId).maybeSingle();
      if (!data) return null;
      const [{ data: balance }, { data: lastOrder }, { data: lastPayment }] = await Promise.all([
        admin.rpc("customer_balance", { _customer_id: recordId }),
        admin
          .from("orders")
          .select("created_at")
          .eq("customer_id", recordId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        admin
          .from("payments")
          .select("paid_on")
          .eq("customer_id", recordId)
          .order("paid_on", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return [
        data.id,
        data.display_name || data.full_name || "",
        data.email,
        data.approval_status,
        num(balance),
        d(lastOrder?.created_at),
        lastPayment?.paid_on ?? "",
      ];
    }
    case "payments": {
      const { data } = await admin.from("payments").select("*").eq("id", recordId).maybeSingle();
      if (!data) return null;
      return [
        data.id,
        data.id.slice(0, 8),
        await customerName(admin, data.customer_id),
        await orderNumber(admin, data.order_id),
        num(data.amount),
        data.method,
        data.paid_on,
        data.notes ?? "",
      ];
    }
    case "expenses": {
      const { data } = await admin.from("expenses").select("*").eq("id", recordId).maybeSingle();
      if (!data) return null;
      return [data.id, data.spent_on, data.category, data.description, num(data.amount), data.notes ?? ""];
    }
    case "account_closings": {
      const { data } = await admin
        .from("account_closings")
        .select("*")
        .eq("id", recordId)
        .maybeSingle();
      if (!data) return null;
      return [
        data.id,
        await customerName(admin, data.customer_id),
        data.period_start ?? "",
        data.period_end,
        num(data.amount_settled),
        num(data.outstanding_after),
        await customerName(admin, data.closed_by),
        d(data.closed_at),
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
    await upsertRow(TABS[table], row);
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
