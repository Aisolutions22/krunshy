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

const createStaffSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  fullName: z.string().trim().min(2).max(100),
});

/** Admin-only: create a sales staff account (موظف مبيعات). */
export const adminCreateSalesStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createStaffSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: adminRoles, error: adminErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin");
    if (adminErr) throw new Error("Forbidden");
    if (!adminRoles || adminRoles.length === 0) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, display_name: data.fullName },
    });
    if (error) throw new Error(error.message);
    const userId = created.user?.id;
    if (!userId) throw new Error("User creation failed");

    // handle_new_user() already inserted the profile + an 'employee' role row.
    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email: data.email,
      full_name: data.fullName,
      display_name: data.fullName,
      approval_status: "approved",
      is_active: true,
    });

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .update({ role: "sales_staff" })
      .eq("user_id", userId);
    if (roleError) throw new Error(roleError.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "admin_create_sales_staff",
      entity: "profile",
      entity_id: userId,
      new_value: { email: data.email, role: "sales_staff" },
    });

    return { ok: true, userId };
  });

const setActiveSchema = z.object({
  userId: z.string().uuid(),
  isActive: z.boolean(),
});

/** Admin-only: activate / deactivate a staff account. */
export const adminSetStaffActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => setActiveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: adminRoles, error: adminErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin");
    if (adminErr) throw new Error("Forbidden");
    if (!adminRoles || adminRoles.length === 0) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: data.isActive })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "admin_set_staff_active",
      entity: "profile",
      entity_id: data.userId,
      new_value: { is_active: data.isActive },
    });

    return { ok: true };
  });

export const STAFF_PAGES = ["orders", "menu", "customers", "expenses", "reports"] as const;

const permissionsSchema = z.object({
  userId: z.string().uuid(),
  allowedPages: z.array(z.enum(STAFF_PAGES)).max(STAFF_PAGES.length),
});

/** Admin-only: set which admin pages a sales staff member can access. */
export const adminSetStaffPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => permissionsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: adminRoles, error: adminErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin");
    if (adminErr) throw new Error("Forbidden");
    if (!adminRoles || adminRoles.length === 0) throw new Error("Forbidden");

    const allowedPages = Array.from(new Set(data.allowedPages));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ staff_allowed_pages: allowedPages })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "admin_set_staff_permissions",
      entity: "profile",
      entity_id: data.userId,
      new_value: { allowedPages },
    });

    return { ok: true };
  });
