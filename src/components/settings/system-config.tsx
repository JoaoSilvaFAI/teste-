import { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type SystemConfigProps = {
  lastUpdatedLabel: string;
  isDirty: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
};

const SystemConfig = ({
  lastUpdatedLabel,
  isDirty,
  isSubmitting,
  onSubmit,
}: SystemConfigProps) => {
  const { register } = useFormContext();

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white/80 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Sistema Config</h2>
          <p className="text-xs text-slate-500">Ajuste identidade visual e fuso horário da operação.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="url_logo" className="text-sm font-semibold text-slate-700">
            Logo (URL pública)
          </Label>
          <Input
            id="url_logo"
            placeholder="https://..."
            className="mt-2 rounded-xl border-slate-200 bg-white"
            {...register("url_logo")}
          />
          <p className="mt-1 text-xs text-slate-500">
            Recomenda-se usar URLs do Supabase Storage.
          </p>
        </div>

        <div>
          <Label htmlFor="fuso_horario" className="text-sm font-semibold text-slate-700">
            Fuso horário
          </Label>
          <Input
            id="fuso_horario"
            placeholder="America/Sao_Paulo"
            className="mt-2 rounded-xl border-slate-200 bg-white"
            {...register("fuso_horario")}
          />
          <p className="mt-1 text-xs text-slate-500">
            Utilizado para agendamentos e horários em mensagens.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 pt-2">
        <div className="text-xs text-slate-500">
          <p>Última atualização</p>
          <p className="font-semibold text-slate-800">{lastUpdatedLabel}</p>
        </div>
        <Button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          onClick={onSubmit}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salvar Configurações"
          )}
        </Button>
      </div>
    </section>
  );
};

export default SystemConfig;