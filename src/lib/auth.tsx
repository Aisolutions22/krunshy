import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  department: string | null;
  phone: string | null;
  approval_status: "pending" | "approved" | "rejected";
  staff_allowed_pages?: string[] | null;
};

type Ctx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  isSalesStaff: boolean;
  allowedPages: string[];
  canPage: (page: string) => boolean;
  isApproved: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSalesStaff, setIsSalesStaff] = useState(false);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const load = async (uid: string | undefined) => {
    if (!uid) {
      setProfile(null);
      setIsAdmin(false);
      setIsSalesStaff(false);
      return;
    }
    const [{ data: prof }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,email,full_name,display_name,department,phone,approval_status,staff_allowed_pages")
        .eq("id", uid)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile((prof as Profile | null) ?? null);
    setIsAdmin(Boolean(roles?.some((r) => r.role === "admin")));
    setIsSalesStaff(Boolean(roles?.some((r) => r.role === "sales_staff")));
  };

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await load(data.session?.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === "SIGNED_IN") {
        setLoading(true);
        void load(newSession?.user.id).then(() => {
          void queryClient.invalidateQueries();
          setLoading(false);
        });
      } else if (event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void load(newSession?.user.id).then(() => {
          if (event === "SIGNED_OUT") queryClient.clear();
          else void queryClient.invalidateQueries();
        });
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo<Ctx>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isAdmin,
      isSalesStaff,
      allowedPages: profile?.staff_allowed_pages ?? [],
      canPage: (page: string) => isAdmin || (profile?.staff_allowed_pages ?? []).includes(page),
      isApproved: profile?.approval_status === "approved",
      loading,
      refresh: async () => load(session?.user.id),
      signOut: async () => {
        await queryClient.cancelQueries();
        queryClient.clear();
        await supabase.auth.signOut();
      },
    }),
    [session, profile, isAdmin, isSalesStaff, loading, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
