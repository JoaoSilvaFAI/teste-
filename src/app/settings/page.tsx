import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showError, showSuccess } from "@/utils/toast";
import { useCompanyConfig } from "@/hooks/use-company-config";
import { useTenantFilter } from "@/hooks/use-tenant-filter";
import { useOpenAIModels, type OpenAIModel } from "@/hooks/use-openai-models";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Save,
  Settings2,
  Sparkles,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";

type FormValues = {
  url_logo: string;
  fuso_horario: string;
  whatsapp_instance_name: string;
  whatsapp_number_display: string;
  evolution_apikey: string;
  evolution_base_url: string;
  openai_model: string;
  prompt_sistema_base: string;
  prompt_personalizacao: string;
};

type TestStatus = "idle" | "loading" | "ok" | "error";

const SectionHeader = ({
  icon,
  title,
  description,
  open,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  open: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    onClick={onToggle}
    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-left transition hover:bg-slate-100"
  >
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm text-slate-600">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
    {open ? (
      <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
    ) : (
      <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
    )}
  </button>
);

const FieldGroup = ({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={htmlFor} className="text-sm font-semibold text-slate-700">
      {label}
    </Label>
    {children}
    {hint && <p className="text-xs text-slate-400">{hint}</p>}
  </div>
);

const StatusBadge = ({ status, okLabel = "Conectado" }: { status: TestStatus; okLabel?: string }) => {
  if (status === "idle") return null;
  if (status === "loading")
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Testando...
      </span>
    );
  if (status === "ok")
    return (
      <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
        <CheckCircle2 className="h-3.5 w-3.5" /> {okLabel}
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-red-500">
      <WifiOff className="h-3.5 w-3.5" /> Falha na conexão
    </span>
  );
};

const SettingsPage = () => {
  const { data, isLoading, isError, error } = useCompanyConfig();
  const queryClient = useQueryClient();
  const { tenantId } = useTenantFilter();
  const { data: models, isLoading: loadingModels, isError: modelsError } = useOpenAIModels();

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    evolution: true,
    system: true,
    agent: true,
  });
  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const [evolutionStatus, setEvolutionStatus] = useState<TestStatus>("idle");
  const [modelStatus, setModelStatus] = useState<TestStatus>("idle");
  const [modelPreview, setModelPreview] = useState<string>("");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isDirty },
  } = useForm<FormValues>({
    defaultValues: {
      url_logo: "",
      fuso_horario: "America/Sao_Paulo",
      whatsapp_instance_name: "",
      whatsapp_number_display: "",
      evolution_apikey: "",
      evolution_base_url: "",
      openai_model: "",
      prompt_sistema_base: "",
      prompt_personalizacao: "",
    },
  });

  useEffect(() => {
    if (data) {
      reset({
        url_logo: data.url_logo ?? "",
        fuso_horario: data.fuso_horario ?? "America/Sao_Paulo",
        whatsapp_instance_name: data.whatsapp_instance_name ?? "",
        whatsapp_number_display: data.whatsapp_number_display ?? "",
        evolution_apikey: data.evolution_apikey ?? "",
        evolution_base_url: "",
        openai_model: data.openai_model ?? "",
        prompt_sistema_base: data.prompt_sistema_base ?? "",
        prompt_personalizacao: data.prompt_personalizacao ?? "",
      });
    }
  }, [data, reset]);

  useEffect(() => {
    const loadCompanyBaseUrl = async () => {
      const targetEmpresaId = data?.empresa_id ?? tenantId;
      if (!targetEmpresaId) return;
      const { data: empresa, error: empErr } = await supabase
        .from("empresas")
        .select("evolution_base_url")
        .eq("id", targetEmpresaId)
        .maybeSingle();
      if (!empErr) {
        setValue("evolution_base_url", empresa?.evolution_base_url ?? "");
      }
    };
    loadCompanyBaseUrl();
  }, [data?.empresa_id, tenantId, setValue]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const targetEmpresaId = data?.empresa_id ?? tenantId;
      if (!targetEmpresaId) throw new Error("Empresa não encontrada.");

      const now = new Date().toISOString();
      const cfgPayload = {
        url_logo: values.url_logo.trim() || null,
        fuso_horario: values.fuso_horario.trim() || null,
        whatsapp_instance_name: values.whatsapp_instance_name.trim() || null,
        whatsapp_number_display: values.whatsapp_number_display.trim() || null,
        evolution_apikey: values.evolution_apikey.trim() || null,
        openai_model: values.openai_model.trim() || null,
        prompt_sistema_base: values.prompt_sistema_base.trim() || null,
        prompt_personalizacao: values.prompt_personalizacao.trim() || null,
        updated_at: now,
      };

      // Verifica se já existe configuração para a empresa
      const { data: existingCfg, error: checkErr } = await supabase
        .from("configuracoes_empresa")
        .select("id")
        .eq("empresa_id", targetEmpresaId)
        .maybeSingle();
      if (checkErr) throw checkErr;

      if (existingCfg) {
        const { error: updateError } = await supabase
          .from("configuracoes_empresa")
          .update(cfgPayload)
          .eq("empresa_id", targetEmpresaId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("configuracoes_empresa")
          .insert([{ ...cfgPayload, empresa_id: targetEmpresaId, created_at: now }]);
        if (insertError) throw insertError;
      }

      // Atualiza Evolution URL na tabela empresas
      const baseUrl = values.evolution_base_url.trim() || null;
      const { error: empError } = await supabase
        .from("empresas")
        .update({ evolution_base_url: baseUrl })
        .eq("id", targetEmpresaId);
      if (empError) throw empError;
    },
    onSuccess: () => {
      showSuccess("Configurações salvas com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["company-config", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: () => {
      showError("Não foi possível salvar as configurações. Tente novamente.");
    },
  });

  const onSubmit = handleSubmit((values) => mutation.mutate(values));

  const handleTestEvolution = async () => {
    const instance = watch("whatsapp_instance_name");
    const apikey = watch("evolution_apikey");
    const customBaseUrl = watch("evolution_base_url")?.trim();
    
    if (!instance || !apikey) {
      showError("Preencha a instância e a API Key antes de testar.");
      return;
    }
    setEvolutionStatus("loading");
    try {
      const rawUrl = customBaseUrl || "https://api.evolution.dev";
      const baseUrl = rawUrl.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/instance/connectionState/${instance}`, {
        headers: { apikey },
      });
      setEvolutionStatus(res.ok ? "ok" : "error");
    } catch {
      setEvolutionStatus("error");
    }
  };

  const handleTestModel = async () => {
    const model = watch("openai_model");
    const promptBase = watch("prompt_sistema_base");
    const promptPersonalizacao = watch("prompt_personalizacao");

    if (!model) {
      showError("Informe o modelo antes de testar.");
      return;
    }

    setModelStatus("loading");
    setModelPreview("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada.");

      const systemContent = [
        promptBase || "Você é uma assistente virtual prestativa.",
        promptPersonalizacao
          ? `<personalizacao>\n${promptPersonalizacao}\n</personalizacao>`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const res = await fetch("https://bgghkwvqtpnsgdpqzrqz.supabase.co/functions/v1/openai-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model,
          prompt: `${systemContent}\n\nUsuário: Olá! Pode se apresentar brevemente seguindo rigorosamente as instruções da sua personalização?`,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? json.message ?? "Erro desconhecido");

      const reply = json.assistant ?? JSON.stringify(json);
      setModelPreview(reply);
      setModelStatus("ok");
    } catch (err: any) {
      setModelStatus("error");
      setModelPreview(err.message ?? "Erro ao conectar com a OpenAI.");
    }
  };

  const lastUpdatedLabel = useMemo(() => {
    if (!data?.updated_at) return "Nunca atualizado";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date(data.updated_at));
  }, [data?.updated_at]);

  const promptPersonalizacao = watch("prompt_personalizacao");
  const charCount = promptPersonalizacao?.length ?? 0;

  if (isLoading)
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-32 rounded-3xl bg-slate-200/80" />
        <Skeleton className="h-64 rounded-3xl bg-slate-200/80" />
      </div>
    );

  if (isError)
    return (
      <div className="p-6">
        <Alert className="rounded-2xl bg-red-50 text-red-600">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Falha ao carregar</AlertTitle>
          <AlertDescription>
            {error instanceof Error
              ? error.message
              : "Não foi possível obter as configurações."}
          </AlertDescription>
        </Alert>
      </div>
    );

  if (!data)
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-8 text-center text-slate-500 m-6">
        Nenhuma configuração encontrada para esta empresa.
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-teal-600 p-6 text-white shadow-xl shadow-slate-400/30">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/70">
              Evolution Core
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              Configurações Multitenant
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/80">
              Configure Evolution, sistema e agente IA por empresa, com
              segurança RLS no Supabase.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-white">
              <Sparkles className="h-4 w-4" />
              Evolução ativa
            </Badge>
            <span className="flex items-center gap-1.5 text-xs text-white/60">
              <Clock className="h-3.5 w-3.5" />
              {lastUpdatedLabel}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Card className="rounded-3xl border border-slate-100 bg-white shadow-sm">
          <CardHeader className="pb-2 px-6 pt-5">
            <SectionHeader
              icon={<Zap className="h-4 w-4" />}
              title="Evolution API"
              description="Instância, número, URL e chave de acesso ao WhatsApp"
              open={openSections.evolution}
              onToggle={() => toggleSection("evolution")}
            />
          </CardHeader>

          {openSections.evolution && (
            <CardContent className="px-6 pb-6 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <FieldGroup label="Nome da instância" htmlFor="whatsapp_instance_name">
                  <Input
                    id="whatsapp_instance_name"
                    placeholder="marcenaria-premium"
                    className="rounded-2xl border-slate-200 bg-slate-50"
                    {...register("whatsapp_instance_name")}
                  />
                </FieldGroup>

                <FieldGroup
                  label="Número exibido (display)"
                  htmlFor="whatsapp_number_display"
                  hint="Ex: +55 11 99999-0000"
                >
                  <Input
                    id="whatsapp_number_display"
                    placeholder="+55 11 99999-0000"
                    className="rounded-2xl border-slate-200 bg-slate-50"
                    {...register("whatsapp_number_display")}
                  />
                </FieldGroup>
              </div>

              <FieldGroup
                label="Evolution URL"
                htmlFor="evolution_base_url"
                hint="Endpoint base da sua instância (ex.: https://api.evolution.dev/minha-instancia)"
              >
                <Input
                  id="evolution_base_url"
                  placeholder="https://api.evolution.dev/minha-instancia"
                  className="rounded-2xl border-slate-200 bg-slate-50"
                  {...register("evolution_base_url")}
                />
              </FieldGroup>

              <FieldGroup label="Evolution API Key" htmlFor="evolution_apikey">
                <Input
                  id="evolution_apikey"
                  type="password"
                  placeholder="••••••••••••"
                  className="rounded-2xl border-slate-200 bg-slate-50"
                  {...register("evolution_apikey")}
                />
              </FieldGroup>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  onClick={handleTestEvolution}
                  disabled={evolutionStatus === "loading"}
                  variant="outline"
                  className="rounded-full border-slate-200 text-sm"
                >
                  {evolutionStatus === "loading" ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wifi className="mr-2 h-3.5 w-3.5" />
                  )}
                  Testar conexão
                </Button>
                <StatusBadge status={evolutionStatus} okLabel="Evolution conectada" />
              </div>
            </CardContent>
          )}
        </Card>

        <Card className="rounded-3xl border border-slate-100 bg-white shadow-sm">
          <CardHeader className="pb-2 px-6 pt-5">
            <SectionHeader
              icon={<Settings2 className="h-4 w-4" />}
              title="Sistema"
              description="Fuso horário, logo e identificadores da empresa"
              open={openSections.system}
              onToggle={() => toggleSection("system")}
            />
          </CardHeader>

          {openSections.system && (
            <CardContent className="px-6 pb-6 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <FieldGroup
                  label="Fuso horário"
                  htmlFor="fuso_horario"
                  hint="Padrão: America/Sao_Paulo"
                >
                  <Input
                    id="fuso_horario"
                    placeholder="America/Sao_Paulo"
                    className="rounded-2xl border-slate-200 bg-slate-50"
                    {...register("fuso_horario")}
                  />
                </FieldGroup>

                <FieldGroup
                  label="URL do logotipo"
                  htmlFor="url_logo"
                  hint="Link público para a imagem da logo"
                >
                  <Input
                    id="url_logo"
                    placeholder="https://exemplo.com/logo.png"
                    className="rounded-2xl border-slate-200 bg-slate-50"
                    {...register("url_logo")}
                  />
                </FieldGroup>
              </div>
            </CardContent>
          )}
        </Card>

        <Card className="rounded-3xl border border-slate-100 bg-white shadow-sm">
          <CardHeader className="pb-2 px-6 pt-5">
            <SectionHeader
              icon={<Bot className="h-4 w-4" />}
              title="Agente IA"
              description="Modelo OpenAI, prompt base e personalização do assistente"
              open={openSections.agent}
              onToggle={() => toggleSection("agent")}
            />
          </CardHeader>

          {openSections.agent && (
            <CardContent className="px-6 pb-6 space-y-6">
              <div className="grid gap-5 sm:grid-cols-2 items-end">
                <div className="space-y-1.5 focus-within:relative z-10">
                  <Label htmlFor="openai_model" className="text-sm font-semibold text-slate-700">
                    Modelo OpenAI
                  </Label>
                  <div className="mt-2">
                    {loadingModels ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                        Carregando modelos...
                      </div>
                    ) : modelsError ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                        Não foi possível carregar modelos.
                      </div>
                    ) : (
                      <Select
                        value={watch("openai_model") || ""}
                        onValueChange={(value) => {
                          setValue("openai_model", value, { shouldDirty: true });
                        }}
                      >
                        <SelectTrigger className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                          <SelectValue placeholder="(Nenhum modelo selecionado)" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          {(models ?? []).map((m: OpenAIModel) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <input type="hidden" {...register("openai_model")} />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Lista atualizada na Edge com os modelos ativos.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    onClick={handleTestModel}
                    disabled={modelStatus === "loading"}
                    variant="outline"
                    className="rounded-full border-slate-200 text-sm w-fit"
                  >
                    {modelStatus === "loading" ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Bot className="mr-2 h-3.5 w-3.5" />
                    )}
                    Testar modelo
                  </Button>
                  <StatusBadge status={modelStatus} okLabel="Modelo respondendo" />
                </div>
              </div>

              {modelPreview && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="mb-1 text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                    Resposta do assistente
                  </p>
                  <p className="text-sm text-emerald-900 whitespace-pre-wrap">{modelPreview}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="prompt_sistema_base"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Prompt base da empresa
                  </Label>
                  <Badge
                    variant="outline"
                    className="text-xs text-slate-400 border-slate-200"
                  >
                    Camada 2 — gerada no cadastro
                  </Badge>
                </div>
                <Textarea
                  id="prompt_sistema_base"
                  rows={8}
                  placeholder="Gerado automaticamente no cadastro da empresa..."
                  className="rounded-2xl border-slate-200 bg-slate-50 font-mono text-xs leading-relaxed resize-none"
                  {...register("prompt_sistema_base")}
                />
                <p className="text-xs text-slate-400">
                  Contém nome, endereço, horários e apresentação da empresa.
                  Editável caso precise corrigir algum dado.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="prompt_personalizacao"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Personalização do assistente
                  </Label>
                  <Badge
                    variant="outline"
                    className="text-xs text-teal-600 border-teal-200 bg-teal-50"
                  >
                    Camada 3 — seus diferenciais
                  </Badge>
                </div>
                <Textarea
                  id="prompt_personalizacao"
                  rows={6}
                  placeholder={`Descreva os diferenciais únicos da sua empresa. Exemplos:\n\n• Trabalhamos exclusivamente com ferragens Blum importadas.\n• 10 anos de garantia em todos os projetos.\n• Prazo médio de entrega: 45 dias após aprovação.\n• Não atendemos projetos abaixo de R$ 15.000.`}
                  className="rounded-2xl border-slate-200 bg-white text-sm leading-relaxed resize-none"
                  {...register("prompt_personalizacao")}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">
                    Essas instruções serão adicionadas ao comportamento do assistente
                    em todos os atendimentos desta empresa.
                  </p>
                  <span
                    className={`text-xs tabular-nums ${
                      charCount > 1500 ? "text-red-500 font-semibold" : "text-slate-400"
                    }`}
                  >
                    {charCount}/2000
                  </span>
                </div>
              </div>

              <div className="flex gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                <Sparkles className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-indigo-700">
                    Comportamento base do assistente
                  </p>
                  <p className="mt-0.5 text-xs text-indigo-600/80">
                    O funil de atendimento, as regras de comportamento e as
                    ferramentas de IA (Kanban, transferência) são controlados
                    pelo sistema e não aparecem aqui.
                  </p>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        <div className="flex items-center justify-between rounded-3xl border border-slate-100 bg-white px-6 py-4 shadow-sm">
          <span className="text-xs text-slate-400">
            {isDirty ? (
              <span className="text-amber-500 font-semibold">
                Há alterações não salvas
              </span>
            ) : (
              "Todas as alterações estão salvas"
            )}
          </span>
          <Button
            type="submit"
            disabled={mutation.isPending || !isDirty}
            className="rounded-full bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-400/30 hover:bg-teal-500 disabled:opacity-50"
          >
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {mutation.isPending ? "Salvando..." : "Salvar configurações"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default SettingsPage;