import { supabase } from "@/integrations/supabase/client";

/** Best-effort audit trail for sensitive admin actions. Never blocks the action. */
export async function logAudit(params: {
  actorId: string | undefined;
  action: string;
  entity: string;
  entityId?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
}) {
  if (!params.actorId) return;
  try {
    // Server-side RPC: admin-only, stamps actor_id from the verified session.
    await supabase.rpc("log_audit", {
      _action: params.action,
      _entity: params.entity,
      _entity_id: params.entityId ?? null,
      _previous_value: (params.previousValue ?? null) as never,
      _new_value: (params.newValue ?? null) as never,
    } as never);
  } catch (e) {
    console.error("audit log failed", e);
  }
}
