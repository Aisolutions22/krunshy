import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  userId: z.string().uuid(),
  newPassword: z.string().min(8).max(72),
});

/** Admin override: set a customer's password without their old one. */
export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: roles, error: rolesError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin");
    if (rolesError) throw new Error("Forbidden");
    if (!roles || roles.length === 0) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);

    // Never log the password itself.
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "admin_reset_password",
      entity: "profile",
      entity_id: data.userId,
      new_value: { reset: true },
    });

    return { ok: true };
  });
