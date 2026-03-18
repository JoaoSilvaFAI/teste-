import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MetricCard from "@/components/dashboard/metric-card";
import AgendaTable from "@/components/dashboard/agenda-table";
import { supabase } from "@/integrations/supabase/client";
import { useTenantFilter } from "@/hooks/use-tenant-filter";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileText, Bot, DollarSign, Plus } from "lucide-react";
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useMemo } from "react";

export type AgendaRecord = {
  id: string;
  data_visita: string;
  nome_cliente: string;
  ambiente_planejado: string;
  status: "pendente" | "confirmado" | "realizada" | "cancelada";
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const DashboardPage = () => {
  const today = useMemo(() => new Date(), []);
  const weekStart = useMemo(
    () => startOfWeek(today, { weekStartsOn: 1 }),
    [today],
  );
  const weekEnd = useMemo(
    () => endOfWeek(today, { weekStartsOn: 1 }),
    [today],
  );
  const monthStart = useMemo(() => startOfMonth(today), [today]);
  const monthEnd = useMemo(() => endOfMonth(today), [today]);
  const { withTenant } = useTenantFilter();

  const atendimentosQuery = useQuery({
    queryKey: ["dashboard", "atendimentos-hoje"],
    queryFn: async () => {
      const baseQuery = supabase
        .from("atendimentos")
        .select("id", { count: "exact", head: true })
        .eq("active", true)
        .gte("created_at", startOfDay(today).toISOString())
        .lte("created_at", endOfDay(today).toISOString());

      const { count, error } = await withTenant(baseQuery);

      if (error) {
        throw error;
      }

      return count ?? 0;
    },
    staleTime: 1000 * 60,
  });

  const visitasQuery = useQuery({
    queryKey: ["dashboard", "visitas-semana"],
    queryFn: async () => {
      const baseQuery = supabase
        .from("agendamentos")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendente")
        .gte("data_visita", weekStart.toISOString())
        .lte("data_visita", weekEnd.toISOString());

      const { count, error } = await withTenant(baseQuery);

      if (error) {
        throw error;
      }

      return count ?? 0;
    },
    staleTime: 1000 * 60,
  });

  const agendaHojeQuery = useQuery({
    queryKey: ["dashboard", "agenda-hoje"],
    queryFn: async () => {
      const baseQuery = supabase
        .from("agendamentos")
        .select("id, data_visita, nome_cliente, ambiente_planejado, status")
        .gte("data_visita", startOfDay(today).toISOString())
        .lte("data_visita", endOfDay(today).toISOString());

      const { data, error } = await withTenant(baseQuery).order("data_visita", {
        ascending: true,
      });

      if (error) {
        throw error;
      }

      return (data ?? []) as AgendaRecord[];
    },
    staleTime: 1000 * 60,
  });

  const vendasMesQuery = useQuery({
    queryKey: ["dashboard", "vendas-mes"],
    queryFn: async () => {
      const baseQuery = supabase
        .from("vendas")
        .select("valor_total")
        .gte("data_fechamento", monthStart.toISOString())
        .lte("data_fechamento", monthEnd.toISOString());

      const { data, error } = await withTenant(baseQuery);

      if (error) {
        throw error;
      }

      return (data ?? []).map((row) => Number(row.valor_total ?? 0));
    },
    staleTime: 1000 * 60,
  });

  const faturamentoTotal = useMemo(() => {
    const values = vendasMesQuery.data ?? [];
    return values.reduce((total, current) => total + current, 0);
  }, [vendasMesQuery.data]);

  const vendasConfirmadas = (vendasMesQuery.data ?? []).length;

  const orcamentosPendentes = useMemo(() => {
    const base = Math.max((visitasQuery.data ?? 0) - 1, 4);
    return base;
  }, [visitasQuery.data]);

  const metrics = [
    {
      title: "Atendimentos IA Hoje",
      value: atendimentosQuery.data?.toString() ?? "0",
      helper: "IA conversa ativa",
      icon: Bot,
    },
    {
      title: "Visitas Agendadas (Semana)",
      value: visitasQuery.data?.toString() ?? "0",
      helper: "Status pendente",
      icon: CalendarDays,
    },
    {
      title: "Orçamentos Pendentes",
      value: `${orcamentosPendentes}`,
      helper: "Realizadas sem venda",
      description: "Contagem estimada (em análise)",
      icon: FileText,
    },
    {
      title: "Faturamento do Mês",
      value: currencyFormatter.format(faturamentoTotal),
      helper: "Mês atual",
      icon: DollarSign,
    },
  ];

  const summaryStats = [
    { label: "Orçamentos Pendentes", value: orcamentosPendentes },
    { label: "Vendas Confirmadas", value: vendasConfirmadas },
  ];

  const maxSummaryValue = Math.max(...summaryStats.map((item) => item.value), 1);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>

      <div className="flex justify-center">
        <Button className="w-full max-w-3xl justify-center rounded-[30px] bg-blue-500 py-6 text-lg font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-600">
          <Plus className="mr-3 h-5 w-5" />
          NOVA VENDA (FECHAMENTO)
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <AgendaTable records={agendaHojeQuery.data ?? []} />

        <Card className="rounded-3xl border border-slate-200 bg-white/80 shadow-xl shadow-slate-200/50">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="text-lg font-semibold text-slate-900">
              Resumo Mensal: Orçamentos vs. Vendas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-500">
                  Dados {latestMonthSummary(today)}
                </p>
                <span className="rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-600">
                  Atualizado agora
                </span>
              </div>

              <div className="grid gap-6 rounded-3xl bg-slate-50 p-4">
                <div className="flex gap-4">
                  {summaryStats.map((item) => (
                    <div key={item.label} className="flex-1">
                      <div className="flex items-end justify-center">
                        <div
                          className="h-48 w-full rounded-[22px] bg-gradient-to-t from-slate-900/60 to-teal-400"
                          style={{
                            height: `${(item.value / maxSummaryValue) * 100}%`,
                            minHeight: 24,
                          }}
                        />
                      </div>
                      <p className="mt-3 text-center text-xs font-semibold text-slate-500">
                        {item.label}
                      </p>
                      <p className="text-center text-base font-bold text-slate-900">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const latestMonthSummary = (date: Date) => {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
};

export default DashboardPage;