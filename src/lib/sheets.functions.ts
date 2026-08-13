import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYNC_TABLE_NAMES = [
  "orders",
  "order_items",
  "profiles",
  "payments",
  "expenses",
  "account_closings",
  "audit_logs",
] as const;
type SyncTableName = (typeof SYNC_TABLE_NAMES)[number];

async function assertAdmin(context: { supabase: { rpc: (fn: "is_admin") => Promise<{ data: unknown }> } }) {
  const { data } = await context.supabase.rpc("is_admin");
  if (data !== true) throw new Error("Forbidden");
}

/** Reports whether the Google Sheets credentials are configured (never returns values). */
export const getSheetsSyncHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    return {
      hasServiceAccount: Boolean(process.env["GOOGLE_SERVICE_ACCOUNT_JSON"]),
      hasSpreadsheetId: Boolean(process.env["GOOGLE_SHEETS_SPREADSHEET_ID"]),
    };
  });

/** Retries a single failed record. */
export const retrySyncRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { table: SyncTableName; recordId: string }) => {
    if (!SYNC_TABLE_NAMES.includes(input.table)) throw new Error("Unknown table");
    if (!/^[0-9a-f-]{36}$/i.test(input.recordId)) throw new Error("Invalid record id");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { syncRecord } = await import("@/lib/sheets/sync.server");
    return syncRecord(data.table, data.recordId);
  });

/** Re-pushes every record of every synced table (full rebuild / backfill). */
export const resyncAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { syncRecord } = await import("@/lib/sheets/sync.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let synced = 0;
    let failed = 0;
    for (const table of SYNC_TABLE_NAMES) {
      const { data } = await supabaseAdmin.from(table).select("id").limit(2000);
      for (const row of data ?? []) {
        const result = await syncRecord(table, row.id);
        if (result.ok) synced++;
        else failed++;
      }
    }
    return { synced, failed };
  });
