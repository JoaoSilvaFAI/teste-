import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CompanyRecord = {
  id: number;
  nome_fantasia: string;
  evolution_instance: string;
  evolution_apikey: string;
  evolution_base_url: string | null;
  created_at: string | null;
  cpf_cnpj: string | null;
};

export const useCompanies = () => {
  return useQuery({
    queryKey: ["companies"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select(
          "id, nome_fantasia, evolution_instance, evolution_apikey, evolution_base_url, created_at, cpf_cnpj",
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []) as CompanyRecord[];
    },
  });
};