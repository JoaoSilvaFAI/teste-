"use client";

import WhatsAppClone from "@/components/chats/whatsapp-clone";
import KanbanBoard from "@/components/chats/kanban-board";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, MessageCircle } from "lucide-react";

export default function ChatsPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-slate-800">Conversas IA</h1>
        <p className="text-sm text-slate-500">Acompanhe seus leads pelo Kanban ou utilize o WhatsApp Web completo.</p>
      </div>

      <Tabs defaultValue="kanban" className="w-full">
        <TabsList className="mb-4 grid w-full max-w-md grid-cols-2 lg:max-w-[400px]">
          <TabsTrigger value="kanban" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span>Kanban CRM</span>
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            <span>WhatsApp Web</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="kanban" className="mt-0 outline-none">
          <KanbanBoard />
        </TabsContent>
        
        <TabsContent value="whatsapp" className="mt-0 outline-none">
          <WhatsAppClone />
        </TabsContent>
      </Tabs>
    </div>
  );
}