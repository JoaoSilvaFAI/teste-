import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/auth-provider";

type TenantFilter = {
  tenantId: number | null;
  isAdmin: boolean;
  withTenant: (query: any) => any;
};

export const useTenantFilter = (): TenantFilter => {
  const { user, isAdmin } = useAuth();

  const membershipQuery = useQuery({
    queryKey: ["tenant-membership", user?.id],
    enabled: Boolean(user?.id), // roda para admin e member
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_empresas")
        .select("empresa_id")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.empresa_id ?? null;
    },
  });

  const tenantId = useMemo(() => {
    return membershipQuery.data ?? null;
  }, [membershipQuery.data]);

  const withTenant = useMemo(() => {
    return (query: any) => {
      if (!tenantId) return query;
      return query.eq("empresa_id", tenantId);
    };
  }, [tenantId]);

  return { tenantId, isAdmin, withTenant };
};