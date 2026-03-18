"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantFilter } from "@/hooks/use-tenant-filter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { X, Bot, CheckCheck, Smile, Paperclip, Send, Mic, Phone, Video, AlertTriangle, Loader2 } from "lucide-react";

interface ChatDrawerProps {
  atendimentoId: number | null;
  onClose: () => void;
  // Passing the full list so we can easily find the active lead's details
  atendimentos: any[];
}

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

export function ChatDrawer({ atendimentoId, onClose, atendimentos }: ChatDrawerProps) {
  const { tenantId } = useTenantFilter();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "lead">("chat");

  const selected = useMemo(
    () => atendimentos.find((a) => a.id === atendimentoId) ?? null,
    [atendimentos, atendimentoId]
  );

  // --- Fetch Messages ---
  const {
    data: mensagens = [],
    isLoading: loadingMsgs,
    isError: errorMsgs,
  } = useQuery({
    queryKey: ["mensagens", atendimentoId],
    enabled: Boolean(atendimentoId),
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historico_mensagens")
        .select("id, role, content, created_at")
        .eq("atendimento_id", atendimentoId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []);
    },
  });

  // --- Scroll to bottom ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, activeTab]);

  // --- Realtime ---
  useEffect(() => {
    if (!atendimentoId) return;
    const channel = supabase
      .channel(`msgs-${atendimentoId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "historico_mensagens",
        filter: `atendimento_id=eq.${atendimentoId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["mensagens", atendimentoId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [atendimentoId, queryClient]);

  // --- Toggle IA ---
  const toggleIA = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const { error } = await supabase
        .from("atendimentos")
        .update({ active })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, active }) => {
      // Optimistic upate the boards visually
      await queryClient.cancelQueries({ queryKey: ["atendimentos", tenantId] });
      const prev = queryClient.getQueryData<any[]>(["atendimentos", tenantId]);
      queryClient.setQueryData<any[]>(["atendimentos", tenantId], (old = []) =>
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

  // --- Send Message ---
  const sendMsg = useMutation({
    mutationFn: async (texto: string) => {
      if (!atendimentoId || !tenantId) throw new Error("Sem atendimento selecionado.");
      if (!selected?.clientes?.[0]?.id) throw new Error("Cliente não encontrado.");

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
            atendimentoId,
            clienteId: selected.clientes[0].id,
            texto,
          }),
        }
      );

      const result = await resp.json();
      if (!resp.ok) throw new Error(result?.error ?? `Erro ao enviar mensagem.`);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mensagens", atendimentoId] });
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

  const nome = selected?.clientes?.[0]?.nome || selected?.clientes?.[0]?.whatsapp_number || "Carregando...";
  const telefone = selected?.clientes?.[0]?.whatsapp_number || "—";

  return (
    <>
      {/* Backdrop */}
      {atendimentoId && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm transition-opacity" 
          onClick={onClose}
        />
      )}
      
      {/* Drawer Panel */}
      <div 
        className={`fixed inset-y-0 right-0 z-50 flex w-[480px] flex-col bg-[#efeae2] shadow-2xl transition-transform duration-300 ease-out ${
          atendimentoId ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {selected ? (
          <>
            {/* Header */}
            <div className="flex flex-col bg-white border-b border-slate-200 shadow-sm z-10">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-500">
                    {nome.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">{nome}</h3>
                    <p className="text-xs text-slate-500">{telefone}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              {/* Tabs selector */}
              <div className="flex w-full px-4 border-t border-slate-100">
                <button 
                  onClick={() => setActiveTab("chat")}
                  className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === "chat" ? "border-teal-500 text-teal-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                >
                  Chat & IA
                </button>
                <button 
                  onClick={() => setActiveTab("lead")}
                  className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === "lead" ? "border-teal-500 text-teal-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                >
                  Dados do Lead
                </button>
              </div>
            </div>

            {/* TAB CONTENT: CHAT */}
            {activeTab === "chat" && (
              <>
                {/* Status Bar */}
                <div className="bg-slate-50 px-5 py-2.5 flex items-center justify-between border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Bot className={`h-4 w-4 ${selected.active ? "text-teal-600" : "text-slate-400"}`} />
                    <span className={`text-xs font-semibold ${selected.active ? "text-teal-700" : "text-slate-500"}`}>
                      {selected.active ? "Inteligência Artificial Ativa" : "IA Pausada (Modo Manual)"}
                    </span>
                  </div>
                  <Switch
                    checked={selected.active ?? false}
                    onCheckedChange={(val) => toggleIA.mutate({ id: selected.id, active: val })}
                    disabled={toggleIA.isPending}
                    className="scale-75"
                  />
                </div>

                <ScrollArea className="flex-1 px-6 py-4">
                  {loadingMsgs && (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
                    </div>
                  )}

                  {errorMsgs && (
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                      <AlertTriangle className="h-5 w-5 text-red-400" />
                      <p className="text-xs text-slate-500">Erro ao carregar mensagens</p>
                    </div>
                  )}

                  {!loadingMsgs && !errorMsgs && (
                    <div className="space-y-3 pb-4">
                      {mensagens.length === 0 && (
                        <p className="py-8 text-center text-sm text-slate-400">Nenhuma mensagem ainda.</p>
                      )}
                      
                      {mensagens.map((msg: any) => {
                        const isUser = msg.role === "user";
                        return (
                          <div key={msg.id} className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
                            <div className={`flex max-w-[85%] flex-col ${isUser ? "items-start" : "items-end"}`}>
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
                                <span className="text-[10px] text-slate-500 font-medium">{formatTime(msg.created_at)}</span>
                                {!isUser && <CheckCheck className="h-3 w-3 text-teal-500" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Input Area */}
                <div className="px-5 py-4 bg-[#f0f2f5] border-t border-slate-200 shadow-xl z-10">
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-slate-400 hover:text-slate-600 rounded-full transition">
                      <Smile className="h-5 w-5" />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-slate-600 rounded-full transition">
                      <Paperclip className="h-5 w-5" />
                    </button>
                    <input
                      placeholder="Mensagem manual..."
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={sendMsg.isPending}
                      className="flex-1 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none border-none shadow-sm"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!inputValue.trim() || sendMsg.isPending}
                      className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors shadow-sm ${inputValue.trim() ? "bg-teal-600 text-white hover:bg-teal-700" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}
                    >
                      {inputValue.trim() ? <Send className="h-5 w-5 ml-1" /> : <Mic className="h-5 w-5" />}
                    </button>
                  </div>
                  {sendMsg.isError && (
                    <p className="mt-2 text-center text-xs font-semibold text-red-500">Falha ao enviar mensagem.</p>
                  )}
                </div>
              </>
            )}

            {/* TAB CONTENT: LEAD DETAILS */}
            {activeTab === "lead" && (
              <ScrollArea className="flex-1 bg-slate-50 p-6">
                <div className="space-y-6">
                  {/* Lead Highlight Info */}
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
                     <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-3">
                        <span className="text-xl font-bold text-slate-400">{nome.slice(0, 2).toUpperCase()}</span>
                     </div>
                     <h2 className="text-lg font-bold text-slate-800">{nome}</h2>
                     <p className="text-sm font-medium text-slate-500 mt-1">{telefone}</p>
                     
                     <div className="flex gap-3 mt-4">
                        <button className="flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 rounded-full text-xs font-bold hover:bg-teal-100 transition">
                           <Phone className="h-3.5 w-3.5" /> Ligar
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-full text-xs font-bold hover:bg-slate-200 transition">
                           <Video className="h-3.5 w-3.5" /> Reunião
                        </button>
                     </div>
                  </div>

                  {/* CRM Fields */}
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                     <h3 className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-4">Informações do Funil</h3>
                     
                     <div className="space-y-4">
                        <div>
                           <label className="text-xs text-slate-500 font-medium">Etapa Atual</label>
                           <p className="text-sm font-semibold text-slate-800 mt-0.5 capitalize">{selected.etapa_atual || 'triagem'}</p>
                        </div>
                        
                        <div>
                           <label className="text-xs text-slate-500 font-medium">Última Interação</label>
                           <p className="text-sm font-semibold text-slate-800 mt-0.5">{formatTime(selected.last_interaction)}</p>
                        </div>

                        <div>
                           <label className="text-xs text-slate-500 font-medium">ID Interno</label>
                           <p className="text-sm font-mono text-slate-400 mt-0.5">#{selected.id}</p>
                        </div>
                     </div>
                  </div>
                </div>
              </ScrollArea>
            )}

          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-slate-400">
            Nenhum atendimento selecionado.
          </div>
        )}
      </div>
    </>
  );
}
