"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantFilter } from "@/hooks/use-tenant-filter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Send, Paperclip, Bot, Phone, Video,
  MoreVertical, CheckCheck, Smile, Mic,
  MessageSquare, RefreshCw, AlertTriangle,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface AtendimentoRow {
  id: number;
  empresa_id: number;
  etapa_atual: string | null;
  active: boolean | null;
  last_interaction: string | null;
  clientes: {
    id: number;
    nome: string | null;
    whatsapp_number: string;
  }[] | null;
}

interface MensagemRow {
  id: number;
  role: string;
  content: string;
  created_at: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const etapaConfig: Record<string, { label: string; color: string; bg: string }> = {
  triagem:      { label: "Triagem",      color: "text-amber-700",   bg: "bg-amber-100" },
  qualificacao: { label: "Qualificação", color: "text-blue-700",    bg: "bg-blue-100" },
  agendamento:  { label: "Agendamento",  color: "text-violet-700",  bg: "bg-violet-100" },
  fechado:      { label: "Fechado",      color: "text-emerald-700", bg: "bg-emerald-100" },
};

const gradients = [
  "from-orange-400 to-rose-500",
  "from-violet-400 to-purple-600",
  "from-sky-400 to-blue-600",
  "from-emerald-400 to-teal-600",
  "from-amber-400 to-orange-500",
  "from-pink-400 to-rose-600",
  "from-indigo-400 to-blue-500",
  "from-teal-400 to-cyan-600",
];

const getGradient = (id: number) => gradients[id % gradients.length];

const getInitials = (nome: string | null, whatsapp: string): string => {
  if (nome) {
    const parts = nome.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return whatsapp.slice(-2);
};

const formatTime = (iso: string | null): string => {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

// ─── Skeletons ─────────────────────────────────────────────────────────────────
const SidebarSkeleton = () => (
  <div className="space-y-1 px-3 py-2">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 rounded-xl p-3">
        <Skeleton className="h-11 w-11 flex-shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-28 rounded" />
          <Skeleton className="h-2 w-20 rounded" />
        </div>
      </div>
    ))}
  </div>
);

const MessagesSkeleton = () => (
  <div className="space-y-4 px-6 py-4">
    {[false, true, false, true, true].map((right, i) => (
      <div key={i} className={`flex ${right ? "justify-end" : "justify-start"}`}>
        <Skeleton className={`h-10 rounded-2xl ${right ? "w-48" : "w-64"}`} />
      </div>
    ))}
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────
const WhatsAppClone: React.FC = () => {
  const { tenantId } = useTenantFilter();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [filter, setFilter] = useState<"all" | "active">("all");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Busca atendimentos ──────────────────────────────────────────────────────
  const {
    data: atendimentos = [],
    isLoading: loadingList,
    isError: errorList,
    refetch: refetchList,
  } = useQuery({
    queryKey: ["atendimentos", tenantId],
    enabled: Boolean(tenantId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atendimentos")
        .select(`
          id, empresa_id, etapa_atual, active, last_interaction,
          clientes ( id, nome, whatsapp_number )
        `)
        .eq("empresa_id", tenantId!)
        .order("last_interaction", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row): AtendimentoRow => ({
        id: row.id,
        empresa_id: row.empresa_id,
        etapa_atual: row.etapa_atual,
        active: row.active,
        last_interaction: row.last_interaction,
        clientes: Array.isArray(row.clientes) ? row.clientes : row.clientes ? [row.clientes] : null,
      }));
    },
  });

  // Auto-seleciona o primeiro atendimento
  useEffect(() => {
    if (!selectedId && atendimentos.length > 0) {
      setSelectedId(atendimentos[0].id);
    }
  }, [atendimentos, selectedId]);

  // ── Busca mensagens do atendimento selecionado ──────────────────────────────
  const {
    data: mensagens = [],
    isLoading: loadingMsgs,
    isError: errorMsgs,
  } = useQuery({
    queryKey: ["mensagens", selectedId],
    enabled: Boolean(selectedId),
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historico_mensagens")
        .select("id, role, content, created_at")
        .eq("atendimento_id", selectedId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MensagemRow[];
    },
  });

  // Scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  // ── Realtime: novas mensagens ───────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) return;
    const channel = supabase
      .channel(`msgs-${selectedId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "historico_mensagens",
        filter: `atendimento_id=eq.${selectedId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["mensagens", selectedId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedId, queryClient]);

  // ── Toggle IA (salva no Supabase com optimistic update) ─────────────────────
  const toggleIA = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const { error } = await supabase
        .from("atendimentos")
        .update({ active })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, active }) => {
      await queryClient.cancelQueries({ queryKey: ["atendimentos", tenantId] });
      const prev = queryClient.getQueryData<AtendimentoRow[]>(["atendimentos", tenantId]);
      queryClient.setQueryData<AtendimentoRow[]>(["atendimentos", tenantId], (old = []) =>
        old.map((a) => a.id === id ? { ...a, active } : a)
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["atendimentos", tenantId], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["atendimentos", tenantId] });
    },
  });

  // ── Envio de mensagem ───────────────────────────────────────────────────────
  const sendMsg = useMutation({
    mutationFn: async (texto: string) => {
      if (!selectedId || !tenantId) throw new Error("Sem atendimento selecionado.");

      const atend = atendimentos.find((a) => a.id === selectedId);
      if (!atend?.clientes?.[0]?.id) throw new Error("Cliente não encontrado.");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Faça login novamente.");

      const resp = await fetch(
        "https://bgghkwvqtpnsgdpqzrqz.supabase.co/functions/v1/send-message",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
            "apikey": session.access_token,
          },
          body: JSON.stringify({
            empresaId: tenantId,
            atendimentoId: selectedId,
            clienteId: atend.clientes?.[0]?.id,
            texto,
          }),
        }
      );

      const result = await resp.json();
      if (!resp.ok) throw new Error(result?.error ?? `Erro ${resp.status} ao enviar mensagem.`);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mensagens", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["atendimentos", tenantId] });
    },
  });

  const handleSend = () => {
    if (!inputValue.trim() || sendMsg.isPending) return;
    sendMsg.mutate(inputValue.trim());
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── Lista filtrada ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return atendimentos.filter((a) => {
      const nome = a.clientes?.[0]?.nome ?? "";
      const tel = a.clientes?.[0]?.whatsapp_number ?? "";
      const match = nome.toLowerCase().includes(searchTerm.toLowerCase()) || tel.includes(searchTerm);
      if (!match) return false;
      if (filter === "active") return a.active === true;
      return true;
    });
  }, [atendimentos, searchTerm, filter]);

  const selected = useMemo(
    () => atendimentos.find((a) => a.id === selectedId) ?? null,
    [atendimentos, selectedId]
  );

  const etapa = selected?.etapa_atual
    ? (etapaConfig[selected.etapa_atual] ?? etapaConfig["triagem"])
    : null;

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex h-[700px] overflow-hidden rounded-2xl shadow-2xl"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#f0f2f5" }}
    >
      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <div className="flex w-[320px] flex-shrink-0 flex-col" style={{ background: "#ffffff", borderRight: "1px solid #e9edef" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #e9edef", background: "#f0f2f5" }}>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/20">
              <MessageSquare className="h-4 w-4 text-teal-600" />
            </div>
            <span className="font-bold text-slate-800" style={{ fontSize: 15 }}>Atendimentos</span>
            {atendimentos.length > 0 && (
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700">
                {atendimentos.length}
              </span>
            )}
          </div>
          <button
            onClick={() => refetchList()}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
            title="Atualizar lista"
          >
            <RefreshCw className={`h-4 w-4 ${loadingList ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3" style={{ background: "#f0f2f5" }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Buscar por nome ou número..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl py-2 pl-9 pr-4 text-sm text-slate-700 placeholder-slate-400 outline-none"
              style={{ background: "#ffffff", border: "1px solid #e9edef", fontSize: 13 }}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 px-4 pb-3" style={{ background: "#f0f2f5" }}>
          {(["all", "active"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="rounded-full px-3 py-1 text-xs font-semibold transition"
              style={{
                background: filter === f ? "#e6f7f5" : "#ffffff",
                color: filter === f ? "#0d9488" : "#64748b",
                border: `1px solid ${filter === f ? "#99e6df" : "#e9edef"}`,
              }}
            >
              {f === "all" ? "Todos" : "IA Ativa"}
            </button>
          ))}
        </div>

        {/* Lista */}
        <ScrollArea className="flex-1">
          {loadingList && <SidebarSkeleton />}

          {errorList && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <AlertTriangle className="h-6 w-6 text-red-400" />
              <p className="text-xs text-slate-500">Erro ao carregar atendimentos</p>
              <button onClick={() => refetchList()} className="text-xs font-semibold text-teal-600 hover:underline">
                Tentar novamente
              </button>
            </div>
          )}

          {!loadingList && !errorList && (
            <div className="space-y-0.5 px-2 pb-3">
              {filtered.length === 0 && (
                <p className="py-10 text-center text-sm text-slate-400">
                  {searchTerm ? "Nenhum resultado" : "Nenhum atendimento encontrado"}
                </p>
              )}
              {filtered.map((atend) => {
                const isSelected = selectedId === atend.id;
                const nome = atend.clientes?.[0]?.nome ?? atend.clientes?.[0]?.whatsapp_number ?? "—";
                const tel = atend.clientes?.[0]?.whatsapp_number ?? "";
                const initials = getInitials(atend.clientes?.[0]?.nome ?? null, tel);
                const gradient = getGradient(atend.clientes?.[0]?.id ?? atend.id);
                const etapaCfg = etapaConfig[atend.etapa_atual ?? "triagem"] ?? etapaConfig["triagem"];

                return (
                  <div
                    key={atend.id}
                    onClick={() => setSelectedId(atend.id)}
                    className="group relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 transition-all"
                    style={{
                      background: isSelected ? "#f0f2f5" : "transparent",
                      borderLeft: isSelected ? "3px solid #0d9488" : "3px solid transparent",
                    }}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white ${gradient}`}>
                        {initials}
                      </div>
                      {atend.active && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 bg-emerald-400" style={{ borderColor: "#ffffff" }} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="truncate text-sm font-semibold text-slate-800">{nome}</p>
                        <span className="ml-2 flex-shrink-0 text-xs text-slate-400">
                          {formatTime(atend.last_interaction)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-slate-400">{tel}</p>
                      <div className="mt-1">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${etapaCfg.bg} ${etapaCfg.color}`}>
                          {etapaCfg.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ── Chat ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col" style={{ background: "#efeae2" }}>
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "#ffffff" }}>
              <MessageSquare className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-slate-400">{loadingList ? "Carregando..." : "Selecione uma conversa"}</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between px-5 py-3" style={{ background: "#f0f2f5", borderBottom: "1px solid #e9edef" }}>
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white ${getGradient(selected.clientes?.[0]?.id ?? selected.id)}`}>
                  {getInitials(selected.clientes?.[0]?.nome ?? null, selected.clientes?.[0]?.whatsapp_number ?? "")}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800" style={{ fontSize: 14 }}>
                      {selected.clientes?.[0]?.nome ?? selected.clientes?.[0]?.whatsapp_number ?? "—"}
                    </h3>
                    {etapa && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${etapa.bg} ${etapa.color}`}>
                        {etapa.label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{selected.clientes?.[0]?.whatsapp_number}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Toggle IA */}
                <div
                  className="flex items-center gap-2 rounded-xl px-3 py-1.5"
                  style={{
                    background: selected.active ? "#e6f7f5" : "#ffffff",
                    border: `1px solid ${selected.active ? "#99e6df" : "#e9edef"}`,
                  }}
                >
                  <Bot className={`h-3.5 w-3.5 ${selected.active ? "text-teal-600" : "text-slate-400"}`} />
                  <span className="text-xs font-semibold" style={{ color: selected.active ? "#0d9488" : "#94a3b8" }}>
                    {selected.active ? "IA Ativa" : "IA Pausada"}
                  </span>
                  <Switch
                    checked={selected.active ?? false}
                    onCheckedChange={(val) => toggleIA.mutate({ id: selected.id, active: val })}
                    disabled={toggleIA.isPending}
                    className="scale-75"
                  />
                </div>

                <button className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700">
                  <Phone className="h-4 w-4" />
                </button>
                <button className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700">
                  <Video className="h-4 w-4" />
                </button>
                <button className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Mensagens */}
            <ScrollArea className="flex-1 px-6 py-4">
              {loadingMsgs && <MessagesSkeleton />}

              {errorMsgs && (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  <p className="text-xs text-slate-500">Erro ao carregar mensagens</p>
                </div>
              )}

              {!loadingMsgs && !errorMsgs && (
                <>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="h-px flex-1" style={{ background: "#d1c4b0" }} />
                    <span className="rounded-full px-3 py-1 text-xs text-slate-500" style={{ background: "#e5ddd5" }}>Hoje</span>
                    <div className="h-px flex-1" style={{ background: "#d1c4b0" }} />
                  </div>

                  {mensagens.length === 0 && (
                    <p className="py-8 text-center text-sm text-slate-400">Nenhuma mensagem ainda.</p>
                  )}

                  <div className="space-y-3">
                    {mensagens.map((msg) => {
                      const isUser = msg.role === "user";
                      return (
                        <div key={msg.id} className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
                          <div className={`flex max-w-[72%] flex-col ${isUser ? "items-start" : "items-end"}`}>
                            <div
                              className="rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm"
                              style={{
                                background: isUser ? "#ffffff" : "#d9fdd3",
                                color: "#111b21",
                                borderTopLeftRadius: isUser ? 4 : undefined,
                                borderTopRightRadius: !isUser ? 4 : undefined,
                              }}
                            >
                              {msg.content}
                            </div>
                            <div className="mt-1 flex items-center gap-1 px-1">
                              <span className="text-[10px] text-slate-400">{formatTime(msg.created_at)}</span>
                              {!isUser && <CheckCheck className="h-3 w-3 text-teal-500" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div ref={messagesEndRef} />
                </>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="px-5 py-4" style={{ background: "#f0f2f5", borderTop: "1px solid #e9edef" }}>
              <div className="flex items-center gap-2">
                <button className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700">
                  <Smile className="h-5 w-5" />
                </button>
                <button className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700">
                  <Paperclip className="h-5 w-5" />
                </button>
                <input
                  placeholder="Digite uma mensagem..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sendMsg.isPending}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none"
                  style={{ background: "#ffffff", border: "1px solid #e9edef", fontSize: 13 }}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || sendMsg.isPending}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition"
                  style={{
                    background: inputValue.trim() ? "#0d9488" : "#e9edef",
                    color: inputValue.trim() ? "#ffffff" : "#94a3b8",
                    cursor: inputValue.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  {inputValue.trim() ? <Send className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              </div>
              {sendMsg.isError && (
                <p className="mt-2 text-center text-xs text-red-500">Erro ao enviar. Tente novamente.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WhatsAppClone;