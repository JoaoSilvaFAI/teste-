import { useMemo, useState, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useCompanies } from "@/hooks/use-companies";
import { useAuth } from "@/auth/auth-provider";
import {
  AlertTriangle,
  Building2,
  Clock,
  Loader2,
  Lock,
  MapPin,
  PlusCircle,
  Search,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";

import CompanyActions from "@/components/companies/company-actions";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type TipoPessoa = "pf" | "pj";

type HorarioDia = {
  ativo: boolean;
  abertura: string;
  fechamento: string;
};

type HorariosSemanais = Record<string, HorarioDia>;

type FormValues = {
  nome_fantasia: string;
  tipo_pessoa: TipoPessoa;
  cpf: string;
  cnpj: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cliente_email: string;
  cliente_password: string;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const DIAS_SEMANA = [
  { key: "segunda", label: "Segunda-feira" },
  { key: "terca", label: "Terça-feira" },
  { key: "quarta", label: "Quarta-feira" },
  { key: "quinta", label: "Quinta-feira" },
  { key: "sexta", label: "Sexta-feira" },
  { key: "sabado", label: "Sábado" },
  { key: "domingo", label: "Domingo" },
];

const HORARIOS_DEFAULT: HorariosSemanais = {
  segunda: { ativo: true, abertura: "08:00", fechamento: "18:00" },
  terca: { ativo: true, abertura: "08:00", fechamento: "18:00" },
  quarta: { ativo: true, abertura: "08:00", fechamento: "18:00" },
  quinta: { ativo: true, abertura: "08:00", fechamento: "18:00" },
  sexta: { ativo: true, abertura: "08:00", fechamento: "18:00" },
  sabado: { ativo: true, abertura: "09:00", fechamento: "13:00" },
  domingo: { ativo: false, abertura: "", fechamento: "" },
};

const HORARIO_OPTIONS = [
  "",
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
];

const CLIENT_CREATION_FUNCTION_URL =
  "https://bgghkwvqtpnsgdpqzrqz.supabase.co/functions/v1/create-client-user";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCPF = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const formatCNPJ = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(
    8,
    12,
  )}-${d.slice(12)}`;
};

const formatCEP = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
};

const horarioParaTexto = (horarios: HorariosSemanais): string =>
  DIAS_SEMANA.map(({ key, label }) => {
    const h = horarios[key];
    if (!h?.ativo || !h.abertura || !h.fechamento)
      return `${label}: Fechado`;
    return `${label}: ${h.abertura} às ${h.fechamento}`;
  }).join("\n");

const enderecoCompleto = (v: FormValues): string =>
  [
    v.logradouro.trim(),
    v.numero.trim() && `nº ${v.numero.trim()}`,
    v.complemento.trim(),
    v.bairro.trim(),
    v.cidade.trim() && v.estado.trim()
      ? `${v.cidade.trim()}/${v.estado.trim().toUpperCase()}`
      : v.cidade.trim() || v.estado.trim().toUpperCase(),
    v.cep.trim() && `CEP ${v.cep.trim()}`,
  ]
    .filter(Boolean)
    .join(", ");

const gerarPromptBase = (empresa: {
  nome_fantasia: string;
  telefone?: string;
  endereco?: string;
  horario_atendimento?: string;
}): string =>
  `<empresa>
  Nome: ${empresa.nome_fantasia}
  WhatsApp/Telefone: ${empresa.telefone ?? "a confirmar com a equipe"}
  Endereço do showroom: ${empresa.endereco ?? "a confirmar com a equipe"}
  Horário de atendimento:
${
  empresa.horario_atendimento
    ? empresa.horario_atendimento
      .split("\n")
      .map((l) => `    ${l}`)
      .join("\n")
    : "    Segunda a Sábado, 8h às 18h"
}
  Segmento: Móveis planejados — residencial e comercial
</empresa>

<apresentacao>
  Você representa a ${empresa.nome_fantasia}.
  Ao iniciar o atendimento, diga:
  "Olá! Sou a assistente virtual da ${empresa.nome_fantasia}. 😊
   Como posso te ajudar hoje?"
</apresentacao>`.trim();

const formatDate = (value: string | null) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
    new Date(value),
  );
};

// ─── Componente ───────────────────────────────────────────────────────────────

const CompaniesPage = () => {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data: companiesData, isLoading, isError, error, refetch } =
    useCompanies();
  const companies = companiesData ?? [];
  const ultimaEmpresa = useMemo(() => companies[0], [companies]);

  const [horarios, setHorarios] = useState<HorariosSemanais>(HORARIOS_DEFAULT);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({
    defaultValues: {
      nome_fantasia: "",
      tipo_pessoa: "pj",
      cpf: "",
      cnpj: "",
      telefone: "",
      cep: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
      cliente_email: "",
      cliente_password: "",
    },
  });

  const tipoPessoa = watch("tipo_pessoa");

  // ── Busca CEP ────────────────────────────────────────────────────────────
  const handleBuscaCep = useCallback(async () => {
    const cep = watch("cep").replace(/\D/g, "");
    if (cep.length !== 8) {
      showError("Informe um CEP válido com 8 dígitos.");
      return;
    }
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) {
        showError("CEP não encontrado.");
        return;
      }
      setValue("logradouro", data.logradouro ?? "");
      setValue("bairro", data.bairro ?? "");
      setValue("cidade", data.localidade ?? "");
      setValue("estado", data.uf ?? "");
    } catch {
      showError("Erro ao buscar o CEP. Verifique sua conexão.");
    } finally {
      setBuscandoCep(false);
    }
  }, [watch, setValue]);

  // ── Horários ─────────────────────────────────────────────────────────────
  const toggleDia = (dia: string) =>
    setHorarios((prev) => ({ ...prev, [dia]: { ...prev[dia], ativo: !prev[dia].ativo } }));

  const setHorario = (dia: string, campo: "abertura" | "fechamento", valor: string) =>
    setHorarios((prev) => ({ ...prev, [dia]: { ...prev[dia], [campo]: valor } }));

  const callCreateClientUser = async ({
    companyId,
    companyName,
    email,
    password,
  }: {
    companyId: number;
    companyName: string;
    email: string;
    password: string;
  }) => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error("Sessão expirada. Faça login novamente.");

    const response = await fetch(CLIENT_CREATION_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        email,
        password,
        company_id: companyId,
        company_name: companyName,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Falha ao criar o acesso do cliente.");
    }
  };

  // ── Mutation ─────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const cpfCnpj =
        values.tipo_pessoa === "pf"
          ? values.cpf.trim() || null
          : values.cnpj.trim() || null;

      const { data: createdCompany, error: insertError } = await supabase
        .from("empresas")
        .insert([{ nome_fantasia: values.nome_fantasia.trim(), cpf_cnpj: cpfCnpj }])
        .select("id, nome_fantasia, created_at, cpf_cnpj")
        .single();

      if (insertError || !createdCompany)
        throw insertError ?? new Error("Falha ao inserir empresa.");

      const timestamp = new Date().toISOString();
      const { error: configError } = await supabase
        .from("configuracoes_empresa")
        .upsert(
          [
            {
              empresa_id: createdCompany.id,
              fuso_horario: "America/Sao_Paulo",
              openai_model: "gpt-4o-mini",
              prompt_sistema_base: gerarPromptBase({
                nome_fantasia: createdCompany.nome_fantasia,
                telefone: values.telefone.trim() || undefined,
                endereco: enderecoCompleto(values) || undefined,
                horario_atendimento: horarioParaTexto(horarios),
              }),
              prompt_personalizacao: null,
              created_at: timestamp,
              updated_at: timestamp,
            },
          ],
          { onConflict: "empresa_id" },
        );

      if (configError) throw configError;

      const clientEmail = values.cliente_email.trim().toLowerCase();
      const clientPassword = values.cliente_password;

      await callCreateClientUser({
        companyId: createdCompany.id,
        companyName: createdCompany.nome_fantasia,
        email: clientEmail,
        password: clientPassword,
      });

      if (user?.id) {
        const { error: linkError } = await supabase.from("user_empresas").insert([
          {
            user_id: user.id,
            empresa_id: createdCompany.id,
            role: isAdmin ? "owner" : "member",
          },
        ]);
        if (linkError) throw linkError;
      }

      return createdCompany;
    },
    onMutate: () => {
      setSubmitError(null);
    },
    onSuccess: async () => {
      showSuccess("Empresa e acesso do cliente cadastrados com sucesso!");
      reset();
      setHorarios(HORARIOS_DEFAULT);
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
      await queryClient.invalidateQueries({ queryKey: ["tenant-membership"] });
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Erro desconhecido.";
      setSubmitError(message);
      showError(`Não foi possível cadastrar a empresa. Detalhe: ${message}`);
    },
  });

  const onSubmit = handleSubmit((values) => {
    setSubmitError(null);
    mutation.mutate(values);
  });

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* HERO */}
      <div className="rounded-3xl bg-gradient-to-r from-indigo-900 via-purple-800 to-pink-600 p-6 text-white shadow-2xl shadow-indigo-500/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/70">
              Acesso Dono do SaaS
            </p>
            <h1 className="mt-3 text-3xl font-semibold">Cadastro de Empresas</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/80">
              Cadastre marcenarias e crie a configuração base do agente IA automaticamente.
            </p>
          </div>
          <Badge className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-white">
            <Sparkles className="h-4 w-4" />
            Fluxo instantâneo
          </Badge>
        </div>
      </div>

      {/* ALERTA DE ERRO */}
      {isError && (
        <Alert className="rounded-2xl border border-red-200 bg-red-50 text-red-700">
          <AlertTitle className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Não foi possível carregar as empresas
          </AlertTitle>
          <AlertDescription className="flex flex-col gap-3 text-xs">
            <span>{error instanceof Error ? error.message : "Atualize a página e tente novamente."}</span>
            <Button
              type="button"
              onClick={() => refetch()}
              className="w-fit rounded-full bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-600"
            >
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {submitError && (
        <Alert className="rounded-2xl border border-red-200 bg-red-50 text-red-700">
          <AlertTitle className="text-sm font-semibold">Erro ao cadastrar empresa</AlertTitle>
          <AlertDescription className="text-xs text-red-700">{submitError}</AlertDescription>
        </Alert>
      )}

      {/* CARDS RESUMO */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border-0 bg-white/90 shadow-xl shadow-indigo-100">
          <CardContent className="space-y-2 p-5">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
              <Building2 className="h-5 w-5 text-indigo-500" /> Total de Empresas
            </div>
            <p className="text-3xl font-bold text-slate-900">{isLoading ? "—" : companies.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 bg-white/90 shadow-xl shadow-indigo-100">
          <CardContent className="space-y-2 p-5">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
              <ShieldCheck className="h-5 w-5 text-emerald-500" /> Último Cadastro
            </div>
            <p className="text-base font-semibold text-slate-900">
              {ultimaEmpresa?.nome_fantasia ?? (isLoading ? "Carregando..." : "—")}
            </p>
            <p className="text-xs text-slate-500">
              {ultimaEmpresa
                ? formatDate(ultimaEmpresa.created_at)
                : isLoading
                  ? "Buscando registros..."
                  : "Cadastre a primeira empresa"}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 bg-white/90 shadow-xl shadow-indigo-100">
          <CardContent className="space-y-2 p-5">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
              <PlusCircle className="h-5 w-5 text-pink-500" /> Configuração automática
            </div>
            <p className="text-sm text-slate-600">
              Ao salvar, criamos a config base do agente IA. Evolution é configurada depois.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* TABELA + FORM */}
      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        {/* TABELA */}
        <Card className="rounded-3xl border border-slate-200 bg-white/95 shadow-xl shadow-slate-200/70">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="text-lg font-semibold text-slate-900">Empresas cadastradas</CardTitle>
            <p className="text-sm text-slate-500">
              Configure a Evolution API em{" "}
              <span className="font-semibold text-indigo-500">Configurações</span> de cada empresa.
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="rounded-3xl border border-dashed border-slate-200 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome Fantasia</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading &&
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={`sk-${i}`}>
                        <TableCell colSpan={4}>
                          <Skeleton className="h-10 rounded-2xl bg-slate-200/70" />
                        </TableCell>
                      </TableRow>
                    ))}
                  {!isLoading && companies.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-sm text-slate-500">
                        Nenhuma empresa encontrada. Cadastre usando o formulário.
                      </TableCell>
                    </TableRow>
                  )}
                  {companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-semibold text-slate-900">{company.nome_fantasia}</TableCell>
                      <TableCell className="text-sm text-slate-600">{company.cpf_cnpj ?? "—"}</TableCell>
                      <TableCell className="text-sm text-slate-500">{formatDate(company.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <CompanyActions company={company as any} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* FORMULÁRIO */}
        <Card className="rounded-3xl border border-slate-100 bg-gradient-to-b from-white to-slate-50 shadow-xl shadow-slate-200/70">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="text-lg font-semibold text-slate-900">Nova empresa</CardTitle>
            <p className="text-sm text-slate-500">
              Evolution API é configurada depois em Configurações.
            </p>
          </CardHeader>

          <CardContent className="px-6 pb-6">
            <form className="space-y-6" onSubmit={onSubmit}>
              {/* ── IDENTIFICAÇÃO ─────────────────────────────────── */}
              <div className="space-y-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">
                  <User className="h-3.5 w-3.5" /> Identificação
                </p>

                {/* Nome Fantasia */}
                <div className="space-y-1.5">
                  <Label htmlFor="nome_fantasia" className="text-sm font-semibold text-slate-700">
                    Nome fantasia <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="nome_fantasia"
                    placeholder="Marcenaria Premium"
                    className="rounded-2xl border-slate-200 bg-white"
                    {...register("nome_fantasia", { required: "Informe o nome fantasia." })}
                  />
                  {errors.nome_fantasia?.message && (
                    <p className="text-xs font-semibold text-red-600">
                      {errors.nome_fantasia.message}
                    </p>
                  )}
                </div>

                {/* Toggle PF/PJ */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-slate-700">Tipo de pessoa</Label>
                  <Controller
                    name="tipo_pessoa"
                    control={control}
                    render={({ field }) => (
                      <div className="grid grid-cols-2 gap-2">
                        {(["pf", "pj"] as TipoPessoa[]).map((tipo) => (
                          <button
                            key={tipo}
                            type="button"
                            onClick={() => field.onChange(tipo)}
                            className={`rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${
                              field.value === tipo
                                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                            }`}
                          >
                            {tipo === "pf" ? "Pessoa Física" : "Pessoa Jurídica"}
                          </button>
                        ))}
                      </div>
                    )}
                  />
                </div>

                {/* CPF ou CNPJ */}
                {tipoPessoa === "pf" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="cpf" className="text-sm font-semibold text-slate-700">
                      CPF
                    </Label>
                    <Controller
                      name="cpf"
                      control={control}
                      render={({ field }) => (
                        <Input
                          id="cpf"
                          placeholder="000.000.000-00"
                          className="rounded-2xl border-slate-200 bg-white"
                          value={field.value}
                          onChange={(e) => field.onChange(formatCPF(e.target.value))}
                        />
                      )}
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="cnpj" className="text-sm font-semibold text-slate-700">
                      CNPJ
                    </Label>
                    <Controller
                      name="cnpj"
                      control={control}
                      render={({ field }) => (
                        <Input
                          id="cnpj"
                          placeholder="00.000.000/0000-00"
                          className="rounded-2xl border-slate-200 bg-white"
                          value={field.value}
                          onChange={(e) => field.onChange(formatCNPJ(e.target.value))}
                        />
                      )}
                    />
                  </div>
                )}

                {/* Telefone */}
                <div className="space-y-1.5">
                  <Label htmlFor="telefone" className="text-sm font-semibold text-slate-700">
                    Telefone / WhatsApp
                  </Label>
                  <Input
                    id="telefone"
                    placeholder="(11) 99999-0000"
                    className="rounded-2xl border-slate-200 bg-white"
                    {...register("telefone")}
                  />
                </div>
              </div>

              {/* ── CREDENCIAIS DO CLIENTE ─────────────────────────── */}
              <div className="space-y-3">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">
                  <Lock className="h-3.5 w-3.5" /> Credenciais de acesso
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cliente_email" className="text-sm font-semibold text-slate-700">
                      E-mail do cliente <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="cliente_email"
                      type="email"
                      placeholder="cliente@empresa.com"
                      className="rounded-2xl border-slate-200 bg-white"
                      autoComplete="email"
                      {...register("cliente_email", {
                        required: "Informe o e-mail do cliente.",
                        pattern: {
                          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                          message: "Informe um e-mail válido.",
                        },
                      })}
                    />
                    {errors.cliente_email?.message && (
                      <p className="text-xs font-semibold text-red-600">
                        {errors.cliente_email.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cliente_password" className="text-sm font-semibold text-slate-700">
                      Senha temporária <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="cliente_password"
                      type="password"
                      placeholder="Mínimo 8 caracteres"
                      className="rounded-2xl border-slate-200 bg-white"
                      autoComplete="new-password"
                      {...register("cliente_password", {
                        required: "Informe uma senha temporária.",
                        minLength: {
                          value: 8,
                          message: "A senha precisa ter pelo menos 8 caracteres.",
                        },
                      })}
                    />
                    {errors.cliente_password?.message ? (
                      <p className="text-xs font-semibold text-red-600">
                        {errors.cliente_password.message}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400">
                        Use letras, números e símbolos para reforçar a segurança.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── ENDEREÇO ──────────────────────────────────────── */}
              <div className="space-y-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">
                  <MapPin className="h-3.5 w-3.5" /> Endereço
                </p>

                {/* CEP */}
                <div className="space-y-1.5">
                  <Label htmlFor="cep" className="text-sm font-semibold text-slate-700">
                    CEP
                  </Label>
                  <div className="flex gap-2">
                    <Controller
                      name="cep"
                      control={control}
                      render={({ field }) => (
                        <Input
                          id="cep"
                          placeholder="00000-000"
                          className="rounded-2xl border-slate-200 bg-white flex-1"
                          value={field.value}
                          onChange={(e) => field.onChange(formatCEP(e.target.value))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleBuscaCep();
                            }
                          }}
                        />
                      )}
                    />
                    <Button
                      type="button"
                      onClick={handleBuscaCep}
                      disabled={buscandoCep}
                      variant="outline"
                      className="rounded-2xl border-slate-200 px-4 shrink-0"
                    >
                      {buscandoCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-400">
                    Digite o CEP e clique em buscar para preencher automaticamente.
                  </p>
                </div>

                {/* Logradouro + Número */}
                <div className="grid grid-cols-[1fr_6rem] gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="logradouro" className="text-sm font-semibold text-slate-700">
                      Logradouro
                    </Label>
                    <Input
                      id="logradouro"
                      placeholder="Rua das Flores"
                      className="rounded-2xl border-slate-200 bg-white"
                      {...register("logradouro")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="numero" className="text-sm font-semibold text-slate-700">
                      Nº
                    </Label>
                    <Input
                      id="numero"
                      placeholder="123"
                      className="rounded-2xl border-slate-200 bg-white"
                      {...register("numero")}
                    />
                  </div>
                </div>

                {/* Complemento + Bairro */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="complemento" className="text-sm font-semibold text-slate-700">
                      Complemento
                    </Label>
                    <Input
                      id="complemento"
                      placeholder="Sala 2, Galpão B..."
                      className="rounded-2xl border-slate-200 bg-white"
                      {...register("complemento")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bairro" className="text-sm font-semibold text-slate-700">
                      Bairro
                    </Label>
                    <Input
                      id="bairro"
                      placeholder="Centro"
                      className="rounded-2xl border-slate-200 bg-white"
                      {...register("bairro")}
                    />
                  </div>
                </div>

                {/* Cidade + UF */}
                <div className="grid grid-cols-[1fr_5rem] gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cidade" className="text-sm font-semibold text-slate-700">
                      Cidade
                    </Label>
                    <Input
                      id="cidade"
                      placeholder="São Paulo"
                      className="rounded-2xl border-slate-200 bg-white"
                      {...register("cidade")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="estado" className="text-sm font-semibold text-slate-700">
                      UF
                    </Label>
                    <Input
                      id="estado"
                      placeholder="SP"
                      maxLength={2}
                      className="rounded-2xl border-slate-200 bg-white uppercase"
                      {...register("estado")}
                    />
                  </div>
                </div>
              </div>

              {/* ── HORÁRIOS ──────────────────────────────────────── */}
              <div className="space-y-3">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">
                  <Clock className="h-3.5 w-3.5" /> Horários de Funcionamento
                </p>
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="grid grid-cols-[1fr_1fr_1fr] bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 border-b border-slate-200">
                    <span>Dia</span>
                    <span>Abertura</span>
                    <span>Fechamento</span>
                  </div>

                  {DIAS_SEMANA.map(({ key, label }, idx) => {
                    const h = horarios[key];
                    return (
                      <div
                        key={key}
                        className={`grid grid-cols-[1fr_1fr_1fr] items-center px-4 py-2.5 gap-2 transition-opacity ${
                          idx < DIAS_SEMANA.length - 1 ? "border-b border-slate-100" : ""
                        } ${!h.ativo ? "opacity-40" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleDia(key)}
                          className="flex items-center gap-2 text-left min-w-0"
                        >
                          <span
                            className={`inline-flex h-4 w-4 shrink-0 rounded border transition ${
                              h.ativo ? "border-indigo-500 bg-indigo-500" : "border-slate-300 bg-white"
                            }`}
                          >
                            {h.ativo && (
                              <svg viewBox="0 0 10 8" className="m-auto h-2.5 w-2.5">
                                <path
                                  d="M1 4l2.5 2.5L9 1"
                                  stroke="white"
                                  strokeWidth="1.5"
                                  fill="none"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </span>
                          <span className="text-xs font-medium text-slate-700 truncate">{label}</span>
                        </button>

                        <select
                          disabled={!h.ativo}
                          value={h.abertura}
                          onChange={(e) => setHorario(key, "abertura", e.target.value)}
                          className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        >
                          {HORARIO_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt || "—"}
                            </option>
                          ))}
                        </select>

                        <select
                          disabled={!h.ativo}
                          value={h.fechamento}
                          onChange={(e) => setHorario(key, "fechamento", e.target.value)}
                          className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        >
                          {HORARIO_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt || "—"}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-400">
                  Desmarque o dia para indicar que a empresa está fechada.
                </p>
              </div>

              {/* ── BOTÃO ─────────────────────────────────────────── */}
              <Button
                type="submit"
                disabled={isSubmitting || mutation.isPending}
                className="w-full rounded-full bg-indigo-600 py-6 text-base font-semibold text-white shadow-lg shadow-indigo-400/40 hover:bg-indigo-500"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cadastrando...
                  </>
                ) : (
                  "Cadastrar empresa agora"
                )}
              </Button>

              <p className="text-center text-xs text-slate-400">
                A Evolution API é configurada depois em{" "}
                <span className="font-semibold text-indigo-500">Configurações</span>.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompaniesPage;