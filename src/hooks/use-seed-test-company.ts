import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const TEST_EMPRESA_ID = 1;

const visitDate = (daysFromNow: number, hour: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const hoursAgo = (hours: number) => {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date.toISOString();
};

const saleDate = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
};

const upsertWithConflict = async (
  table: string,
  rows: Record<string, unknown>[],
) => {
  if (!rows.length) {
    return;
  }

  const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });

  if (error) {
    throw error;
  }
};

export const useSeedTestCompany = () => {
  useEffect(() => {
    const seed = async () => {
      const companyPayload = {
        id: TEST_EMPRESA_ID,
        nome_fantasia: "Marcenaria Silva",
        evolution_instance: "marcenaria-silva",
        evolution_apikey: "evo-key-marcenaria-silva",
        evolution_base_url: "https://api.evolution.dev/marcenaria-silva",
        cpf_cnpj: "12.345.678/0001-90",
      };

      const { error: companyError } = await supabase
        .from("empresas")
        .upsert([companyPayload], { onConflict: "id" });

      if (companyError) {
        throw companyError;
      }

      const configPayload = {
        empresa_id: TEST_EMPRESA_ID,
        url_logo:
          "https://images.unsplash.com/photo-1505693314120-0d443867891c?w=600",
        fuso_horario: "America/Sao_Paulo",
        whatsapp_instance_name: "marcenaria-silva",
        whatsapp_number_display: "+55 11 99888-7766",
        evolution_apikey: "evo-key-marcenaria-silva",
        openai_model: "gpt-4o-mini",
        prompt_sistema_base:
          "Você é a assistente virtual da Marcenaria Silva, especialista em móveis planejados premium. Conduza o lead das etapas de triagem até agendamento de visita técnica com tom consultivo e acolhedor.",
        prompt_personalizacao:
          "Reforce garantia de 10 anos, ferragens Blum e prazos rápidos.",
        updated_at: new Date().toISOString(),
      };

      const { data: existingConfig, error: configError } = await supabase
        .from("configuracoes_empresa")
        .select("id")
        .eq("empresa_id", TEST_EMPRESA_ID)
        .maybeSingle();

      if (configError) {
        throw configError;
      }

      if (existingConfig) {
        const { error: updateError } = await supabase
          .from("configuracoes_empresa")
          .update(configPayload)
          .eq("empresa_id", TEST_EMPRESA_ID);

        if (updateError) {
          throw updateError;
        }
      } else {
        const { error: insertError } = await supabase
          .from("configuracoes_empresa")
          .insert([{ ...configPayload, created_at: new Date().toISOString() }]);

        if (insertError) {
          throw insertError;
        }
      }

      const clients = [
        {
          id: 1001,
          empresa_id: TEST_EMPRESA_ID,
          whatsapp_number: "+5511988880001",
          nome: "Ana Ribeiro",
        },
        {
          id: 1002,
          empresa_id: TEST_EMPRESA_ID,
          whatsapp_number: "+5511977770002",
          nome: "Carlos Lima",
        },
        {
          id: 1003,
          empresa_id: TEST_EMPRESA_ID,
          whatsapp_number: "+5511966660003",
          nome: "Patrícia Nogueira",
        },
      ];

      const atendimentos = [
        {
          id: 2001,
          empresa_id: TEST_EMPRESA_ID,
          cliente_id: 1001,
          etapa_atual: "qualificacao",
          active: true,
          last_interaction: hoursAgo(2),
        },
        {
          id: 2002,
          empresa_id: TEST_EMPRESA_ID,
          cliente_id: 1002,
          etapa_atual: "triagem",
          active: true,
          last_interaction: hoursAgo(5),
        },
        {
          id: 2003,
          empresa_id: TEST_EMPRESA_ID,
          cliente_id: 1003,
          etapa_atual: "agendamento",
          active: false,
          last_interaction: hoursAgo(22),
        },
      ];

      const agendamentos = [
        {
          id: 3001,
          empresa_id: TEST_EMPRESA_ID,
          cliente_id: 1001,
          atendimento_id: 2001,
          data_visita: visitDate(0, 10),
          ambiente_planejado: "Cozinha integrada",
          endereco_visita: "Rua das Palmeiras, 410 - São Paulo",
          status: "confirmado",
        },
        {
          id: 3002,
          empresa_id: TEST_EMPRESA_ID,
          cliente_id: 1002,
          atendimento_id: 2002,
          data_visita: visitDate(1, 14),
          ambiente_planejado: "Sala gourmet",
          endereco_visita: "Av. Europa, 88 - São Paulo",
          status: "pendente",
        },
        {
          id: 3003,
          empresa_id: TEST_EMPRESA_ID,
          cliente_id: 1003,
          atendimento_id: 2003,
          data_visita: visitDate(-1, 16),
          ambiente_planejado: "Quarto master",
          endereco_visita: "Alameda Jaú, 3020 - São Paulo",
          status: "realizada",
        },
      ];

      const vendas = [
        {
          id: 4001,
          empresa_id: TEST_EMPRESA_ID,
          cliente_id: 1001,
          valor_total: 48000,
          data_fechamento: saleDate(4),
        },
        {
          id: 4002,
          empresa_id: TEST_EMPRESA_ID,
          cliente_id: 1003,
          valor_total: 32500,
          data_fechamento: saleDate(12),
        },
      ];

      const historicoMensagens = [
        {
          id: 5001,
          empresa_id: TEST_EMPRESA_ID,
          atendimento_id: 2001,
          role: "assistant",
          content:
            "Olá Ana! Aqui é a assistente da Marcenaria Silva. Podemos agendar a visita técnica amanhã às 10h?",
          created_at: hoursAgo(3),
        },
        {
          id: 5002,
          empresa_id: TEST_EMPRESA_ID,
          atendimento_id: 2001,
          role: "user",
          content: "Perfeito, estarei em casa às 10h!",
          created_at: hoursAgo(2.5),
        },
      ];

      await upsertWithConflict("clientes", clients);
      await upsertWithConflict("atendimentos", atendimentos);
      await upsertWithConflict("agendamentos", agendamentos);
      await upsertWithConflict("vendas", vendas);
      await upsertWithConflict("historico_mensagens", historicoMensagens);
    };

    seed().catch((error) => {
      console.error(
        "[useSeedTestCompany] Falha ao criar Marcenaria Silva",
        error,
      );
    });
  }, []);
};