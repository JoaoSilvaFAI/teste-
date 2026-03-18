"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantFilter } from "@/hooks/use-tenant-filter";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import { ChatDrawer } from "./chat-drawer";

// --- Types ---
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

const COLUMNS = [
  { id: "triagem", title: "Triagem", color: "bg-amber-100 text-amber-800", borderColor: "border-amber-200" },
  { id: "qualificacao", title: "Qualificação", color: "bg-blue-100 text-blue-800", borderColor: "border-blue-200" },
  { id: "agendamento", title: "Agendamento", color: "bg-violet-100 text-violet-800", borderColor: "border-violet-200" },
  { id: "fechado", title: "Fechado", color: "bg-emerald-100 text-emerald-800", borderColor: "border-emerald-200" },
];

const formatTime = (iso: string | null): string => {
  if (!iso) return "—";
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

export default function KanbanBoard() {
  const { tenantId } = useTenantFilter();
  const queryClient = useQueryClient();

  // Local state to power the UI optimistically immediately on drag
  const [items, setItems] = useState<AtendimentoRow[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [drawerOpenId, setDrawerOpenId] = useState<number | null>(null);

  // --- Fetch Data ---
  const {
    data: fetchedAtendimentos = [],
    isLoading,
    isError,
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
        etapa_atual: row.etapa_atual || "triagem",
        active: row.active,
        last_interaction: row.last_interaction,
        clientes: Array.isArray(row.clientes) ? row.clientes : row.clientes ? [row.clientes] : null,
      }));
    },
  });

  // Sync server data to local items anytime fetch finishes
  useEffect(() => {
    setItems(fetchedAtendimentos);
  }, [fetchedAtendimentos]);

  // --- Mutations ---
  const updateEtapa = useMutation({
    mutationFn: async ({ id, newEtapa }: { id: number; newEtapa: string }) => {
      const { error } = await supabase
        .from("atendimentos")
        .update({ etapa_atual: newEtapa })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, newEtapa }) => {
      // Opt UI
      await queryClient.cancelQueries({ queryKey: ["atendimentos", tenantId] });
      const prev = queryClient.getQueryData<AtendimentoRow[]>(["atendimentos", tenantId]);
      queryClient.setQueryData<AtendimentoRow[]>(["atendimentos", tenantId], (old = []) =>
        old.map((a) => a.id === id ? { ...a, etapa_atual: newEtapa } : a)
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      // Revert if error
      if (ctx?.prev) queryClient.setQueryData(["atendimentos", tenantId], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["atendimentos", tenantId] });
    },
  });

  // --- DnD Setup ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(Number(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeItem = items.find((i) => i.id.toString() === active.id.toString());
    if (!activeItem) return;

    // Is it hovering over a column id?
    const overColumnId = COLUMNS.find(c => c.id === over.id)?.id;
    
    // Is it hovering over another item? Find the column of the hovered item
    const overItem = items.find((i) => i.id.toString() === over.id.toString());
    const targetColumn = overColumnId || overItem?.etapa_atual || "triagem";

    if (activeItem.etapa_atual !== targetColumn) {
      setItems((prev) => {
        return prev.map((item) =>
          item.id === activeItem.id ? { ...item, etapa_atual: targetColumn } : item
        );
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeItem = items.find((i) => i.id.toString() === active.id.toString());
    if (!activeItem) return;

    // Confirm final position mapped
    const finalEtapa = activeItem.etapa_atual || "triagem";
    
    // Trigger mutation to save to db
    const originalItem = fetchedAtendimentos.find((i) => i.id.toString() === active.id.toString());
    if (originalItem && originalItem.etapa_atual !== finalEtapa) {
      updateEtapa.mutate({ id: activeItem.id, newEtapa: finalEtapa });
    }
  };

  // Build columns based on local `items` State
  const boards = useMemo(() => {
    const acc: Record<string, AtendimentoRow[]> = {
      triagem: [], qualificacao: [], agendamento: [], fechado: [],
    };
    items.forEach(a => {
      const etapa = a.etapa_atual || "triagem";
      if (acc[etapa]) acc[etapa].push(a);
      else acc["triagem"].push(a);
    });
    return acc;
  }, [items]);

  const activeDragItem = items.find(i => i.id === activeId);

  if (isError) {
    return (
      <div className="flex h-[740px] w-full flex-col items-center justify-center rounded-2xl bg-white shadow-xl">
        <AlertTriangle className="h-10 w-10 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Erro ao carregar o Kanban</h2>
      </div>
    );
  }

  if (isLoading && items.length === 0) {
    return (
      <div className="flex h-[740px] w-full flex-col items-center justify-center rounded-2xl bg-white shadow-xl">
        <Loader2 className="h-10 w-10 text-teal-500 mb-4 animate-spin" />
        <h2 className="text-xl font-bold text-slate-800">Carregando CRM...</h2>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-[740px] w-full gap-4 overflow-x-auto rounded-2xl bg-[#f0f2f5] p-4 shadow-inner">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            color={col.color}
            borderColor={col.borderColor}
            items={boards[col.id] || []}
            onOpenDrawer={(id) => setDrawerOpenId(id)}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 250, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {activeDragItem ? (
          <div className="opacity-90 w-80">
            <KanbanCard
              id={activeDragItem.id}
              nome={activeDragItem.clientes?.[0]?.nome || activeDragItem.clientes?.[0]?.whatsapp_number || "Sem Nome"}
              telefone={activeDragItem.clientes?.[0]?.whatsapp_number || ""}
              last_interaction={formatTime(activeDragItem.last_interaction)}
              active={activeDragItem.active}
              borderColor={COLUMNS.find(c => c.id === activeDragItem.etapa_atual)?.borderColor || "border-slate-200"}
              isOverlay
            />
          </div>
        ) : null}
      </DragOverlay>

      <ChatDrawer 
        atendimentoId={drawerOpenId} 
        onClose={() => setDrawerOpenId(null)} 
        atendimentos={items} 
      />
    </DndContext>
  );
}