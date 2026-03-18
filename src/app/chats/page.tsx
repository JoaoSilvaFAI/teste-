"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import KanbanBoard from "@/components/chats/kanban-board";
import WhatsappClone from "@/components/chats/whatsapp-clone"
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Kanban } from "lucide-react";

const ChatsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Cabeçalho da página */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Conversas IA</h1>
          <p className="text-slate-600">
            Gerencie atendimentos e visualize o fluxo de interações com clientes
          </p>
        </div>
      </div>

      {/* Componente de abas */}
      <Tabs defaultValue="kanban" className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-xl bg-slate-100 p-1">
          <TabsTrigger
            value="kanban"
            className="flex items-center gap-2 rounded-lg py-3 px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Kanban className="h-4 w-4" />
            Kanban de Atendimentos
          </TabsTrigger>
          <TabsTrigger
            value="whatsapp"
            className="flex items-center gap-2 rounded-lg py-3 px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <MessageSquare className="h-4 w-4" />
            WhatsApp Web
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="kanban" className="space-y-4">
            <KanbanBoard />
          </TabsContent>

          <TabsContent value="whatsapp" className="space-y-4">
            <Card className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-center">
              <WhatsappClone />
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default ChatsPage;