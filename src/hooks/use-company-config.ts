import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantFilter } from "@/hooks/use-tenant-filter";

export type CompanyConfig = {
  id: number;
  empresa_id: number;
  url_logo: string | null;
  fuso_horario: string | null;
  whatsapp_instance_name: string | null;
  whatsapp_number_display: string | null;
  evolution_apikey: string | null;
  openai_model: string | null;
  prompt_sistema_base: string | null;
  prompt_personalizacao: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export const useCompanyConfig = () => {
  const { tenantId, withTenant } = useTenantFilter();

  return useQuery({
    queryKey: ["company-config", tenantId],
    enabled: Boolean(tenantId),
    staleTime: 60_000,
    queryFn: async () => {
      const baseQuery = supabase
        .from("configuracoes_empresa")
        .select(
          "id, empresa_id, url_logo, fuso_horario, whatsapp_instance_name, whatsapp_number_display, evolution_apikey, openai_model, prompt_sistema_base, prompt_personalizacao, created_at, updated_at",
        );

      const { data, error } = await withTenant(baseQuery).single();

      if (error) {
        throw error;
      }

      return data as CompanyConfig;
    },
  });
};