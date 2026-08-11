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
    await supabase.from("audit_logs").insert({
      actor_id: params.actorId,
      action: params.action,
      entity: params.entity,
      entity_id: params.entityId ?? null,
      previous_value: (params.previousValue ?? null) as never,
      new_value: (params.newValue ?? null) as never,
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
