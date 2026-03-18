"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KanbanCard } from "./kanban-card";

interface KanbanColumnProps {
  id: string;
  title: string;
  color: string;
  borderColor: string;
  items: any[];
  onOpenDrawer: (id: number) => void;
}

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

export function KanbanColumn({ id, title, color, borderColor, items, onOpenDrawer }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });

  return (
    <div 
      className={`flex w-80 flex-shrink-0 flex-col rounded-xl bg-slate-100 p-3 shadow-sm border-2 transition-colors ${isOver ? 'border-teal-400 bg-teal-50/50' : 'border-slate-200'}`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="font-semibold text-slate-700">{title}</h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${color}`}>
          {items.length}
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div 
          ref={setNodeRef} 
          className="flex flex-col gap-3 pb-4 pr-2 min-h-[500px]"
        >
          <SortableContext items={items.map((i) => i.id.toString())} strategy={verticalListSortingStrategy}>
            {items.map((item) => {
              const nome = item.clientes?.[0]?.nome || item.clientes?.[0]?.whatsapp_number || "Sem Nome";
              const telefone = item.clientes?.[0]?.whatsapp_number || "";
              return (
                <KanbanCard
                  key={item.id}
                  id={item.id}
                  nome={nome}
                  telefone={telefone}
                  last_interaction={formatTime(item.last_interaction)}
                  active={item.active}
                  borderColor={borderColor}
                  onClick={() => onOpenDrawer(item.id)}
                />
              );
            })}
            {items.length === 0 && (
              <div className="mt-2 text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 rounded-lg py-8 flex flex-col items-center justify-center pointer-events-none opacity-50">
                Solte os leads aqui
              </div>
            )}
          </SortableContext>
        </div>
      </ScrollArea>
    </div>
  );
}
