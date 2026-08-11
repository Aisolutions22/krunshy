import { createFileRoute } from "@tanstack/react-router";

// Public endpoint called by the database trigger (pg_net) after a record changes.
// Authenticity is proven by the shared token header; nothing else is trusted.
export const Route = createFileRoute("/api/public/sync-sheets")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["SHEETS_SYNC_TOKEN"];
        const provided = request.headers.get("x-sync-token");
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: { table?: string; record_id?: string };
        try {
          payload = (await request.json()) as { table?: string; record_id?: string };
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const { SYNC_TABLES, enqueueSync } = await import("@/lib/sheets/sync.server");
        const table = payload.table;
        const recordId = payload.record_id;
        if (
          !table ||
          !recordId ||
          !SYNC_TABLES.includes(table as (typeof SYNC_TABLES)[number]) ||
          !/^[0-9a-f-]{36}$/i.test(recordId)
        ) {
          return new Response("Invalid payload", { status: 400 });
        }

        const result = await enqueueSync(table as (typeof SYNC_TABLES)[number], recordId);
        // Always 200: a sync failure must never make the database trigger retry-loop.
        return Response.json({ ok: result.ok });
      },
    },
  },
});
