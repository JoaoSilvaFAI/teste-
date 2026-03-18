"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { showSuccess, showError } from "@/utils/toast";
import { Edit, Trash2 } from "lucide-react";
import { useAuth } from "@/auth/auth-provider";

type Company = {
  id: number;
  nome_fantasia: string;
  evolution_instance: string;
  evolution_apikey: string;
  evolution_base_url?: string | null;
  cpf_cnpj?: string | null;
};

type Props = {
  company: Company;
};

type FormValues = {
  nome_fantasia: string;
  evolution_instance: string;
  evolution_apikey: string;
  evolution_base_url: string;
  cpf_cnpj: string;
};

const CompanyActions: React.FC<Props> = ({ company }) => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty },
  } = useForm<FormValues>({
    defaultValues: {
      nome_fantasia: company.nome_fantasia ?? "",
      evolution_instance: company.evolution_instance ?? "",
      evolution_apikey: company.evolution_apikey ?? "",
      evolution_base_url: company.evolution_base_url ?? "",
      cpf_cnpj: company.cpf_cnpj ?? "",
    },
  });

  useEffect(() => {
    reset({
      nome_fantasia: company.nome_fantasia ?? "",
      evolution_instance: company.evolution_instance ?? "",
      evolution_apikey: company.evolution_apikey ?? "",
      evolution_base_url: company.evolution_base_url ?? "",
      cpf_cnpj: company.cpf_cnpj ?? "",
    });
  }, [company, reset]);

  const onUpdate = handleSubmit(async (values) => {
    const payload = {
      nome_fantasia: values.nome_fantasia.trim(),
      evolution_instance: values.evolution_instance.trim(),
      evolution_apikey: values.evolution_apikey.trim(),
      evolution_base_url: values.evolution_base_url.trim() || null,
      cpf_cnpj: values.cpf_cnpj.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("empresas").update(payload).eq("id", company.id);

    if (error) {
      showError("Falha ao atualizar empresa: " + (error.message ?? String(error)));
      return;
    }

    showSuccess("Empresa atualizada com sucesso!");
    queryClient.invalidateQueries({ queryKey: ["companies"] });
    queryClient.invalidateQueries({ queryKey: ["tenant-membership"] });
    setIsEditOpen(false);
  });

  const onDelete = async () => {
    if (!isAdmin) {
      showError("Apenas o Dono do SaaS pode excluir empresas.");
      return;
    }

    if (!confirm(`Confirma exclusão da empresa "${company.nome_fantasia}"? Esta ação é irreversível.`)) {
      return;
    }

    setIsDeleting(true);
    const { error } = await supabase.from("empresas").delete().eq("id", company.id);

    if (error) {
      showError("Falha ao excluir empresa: " + (error.message ?? String(error)));
      setIsDeleting(false);
      return;
    }

    showSuccess("Empresa excluída com sucesso.");
    queryClient.invalidateQueries({ queryKey: ["companies"] });
    queryClient.invalidateQueries({ queryKey: ["tenant-membership"] });
    setIsDeleting(false);
  };

  if (!isAdmin) return null;

  return (
    <div className="flex items-center justify-end gap-2">
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 px-3">
            <Edit className="mr-2 h-4 w-4" /> Editar
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar empresa</DialogTitle>
            <p className="text-sm text-slate-500 mt-1">Altere os dados da empresa.</p>
          </DialogHeader>

          <form onSubmit={onUpdate} className="space-y-4 py-4">
            <div>
              <Label htmlFor="nome_fantasia">Nome fantasia</Label>
              <Input id="nome_fantasia" {...register("nome_fantasia", { required: true })} />
            </div>

            <div>
              <Label htmlFor="evolution_instance">Instância Evolution</Label>
              <Input id="evolution_instance" {...register("evolution_instance", { required: true })} />
            </div>

            <div>
              <Label htmlFor="cpf_cnpj">CPF/CNPJ</Label>
              <Input id="cpf_cnpj" {...register("cpf_cnpj")} />
            </div>

            <div>
              <Label htmlFor="evolution_base_url">Base URL</Label>
              <Input id="evolution_base_url" {...register("evolution_base_url")} />
            </div>

            <div>
              <Label htmlFor="evolution_apikey">Evolution API Key</Label>
              <Input id="evolution_apikey" {...register("evolution_apikey")} type="password" />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting || !isDirty} className="rounded-full">
                {isSubmitting ? "Salvando..." : "Salvar"}
              </Button>
              <Button variant="ghost" onClick={() => setIsEditOpen(false)}>
                Cancelar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" className="h-8 px-3">
            <Trash2 className="mr-2 h-4 w-4" /> Excluir
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação removerá a empresa e possivelmente dados associados. Confirme se deseja prosseguir.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} disabled={isDeleting}>
              {isDeleting ? "Excluindo..." : "Confirmar exclusão"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CompanyActions;