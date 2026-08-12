import { createFileRoute } from "@tanstack/react-router";

/** Length-safe, constant-time string comparison (no early exit on mismatch). */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

// Public endpoint called by the database trigger (pg_net) after a record changes.
// Authenticity is proven by the rotating internal token, which lives only in the
// service-role-only sync_config row - never in a file, migration literal or Git.
export const Route = createFileRoute("/api/public/sync-sheets")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-sync-token");
        if (!provided) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: cfg } = await supabaseAdmin
          .from("sync_config")
          .select("sync_token")
          .limit(1)
          .maybeSingle();

        if (!cfg?.sync_token || !timingSafeEqual(provided, cfg.sync_token)) {
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
