"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Clock, Bot, MessagesSquare } from "lucide-react";

interface KanbanCardProps {
  id: number;
  nome: string;
  telefone: string;
  last_interaction: string;
  active: boolean | null;
  borderColor: string;
  isOverlay?: boolean;
  onClick?: () => void;
}

export function KanbanCard({
  id,
  nome,
  telefone,
  last_interaction,
  active,
  borderColor,
  isOverlay,
  onClick,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: id.toString(),
    data: { id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isDragging && !isOverlay) {
    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        className="h-[84px] w-full rounded-lg bg-slate-200 opacity-50 border-2 border-dashed border-slate-300"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`group relative flex cursor-grab active:cursor-grabbing flex-col gap-2 rounded-lg bg-white p-3 shadow-sm transition-shadow hover:shadow-md border-l-4 ${borderColor} ${isOverlay ? 'shadow-xl cursor-grabbing' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-sm text-slate-800 line-clamp-1">{nome}</span>
        <div className="flex-shrink-0 flex items-center gap-1 text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md">
          <Clock className="h-3 w-3" />
          {last_interaction}
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1.5 text-xs">
          {active ? (
            <span className="flex items-center gap-1 text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded font-medium">
              <Bot className="h-3.5 w-3.5" /> IA Ativa
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
              <Bot className="h-3.5 w-3.5 opacity-50" /> IA Pausada
            </span>
          )}
        </div>
        <button className="text-slate-300 hover:text-teal-600 transition" 
          onPointerDown={(e) => {
             // Prevent drag start when clicking the button
             e.stopPropagation();
          }}
        >
          <MessagesSquare className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}