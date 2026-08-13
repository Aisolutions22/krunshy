// Server-only: shared authenticity check for the internal sync endpoints.
// The token lives only in the service-role-only sync_config row.

/** Length-safe, constant-time string comparison (no early exit on mismatch). */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export async function isAuthorizedSyncRequest(request: Request): Promise<boolean> {
  const provided = request.headers.get("x-sync-token");
  if (!provided) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: cfg } = await supabaseAdmin
    .from("sync_config")
    .select("sync_token")
    .limit(1)
    .maybeSingle();
  return Boolean(cfg?.sync_token) && timingSafeEqual(provided, cfg!.sync_token);
}
