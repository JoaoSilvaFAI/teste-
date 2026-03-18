import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { showError, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type EvolutionConfigProps = {
  testResult: {
    ok: boolean;
    status?: number;
    body?: unknown;
    message?: string;
  } | null;
  setTestResult: (result: {
    ok: boolean;
    status?: number;
    body?: unknown;
    message?: string;
  } | null) => void;
  testing: boolean;
  setTesting: (testing: boolean) => void;
};

const EvolutionConfig = ({
  testResult,
  setTestResult,
  testing,
  setTesting,
}: EvolutionConfigProps) => {
  const { register } = useFormContext();

  const testEvolutionConnection = async () => {
    setTestResult(null);

    const { data } = await supabase
      .from("configuracoes_empresa")
      .select("evolution_apikey, whatsapp_instance_name, empresa_id")
      .single();

    if (!data) {
      showError("Nenhuma configuração disponível para testar.");
      return;
    }

    const apiKey = data.evolution_apikey;
    if (!apiKey) {
      showError("Chave Evolution (evolution_apikey) ausente nas configurações.");
      return;
    }

    let instanceName = data.whatsapp_instance_name ?? null;

    if (!instanceName && data.empresa_id) {
      const { data: empresaRow, error: empErr } = await supabase
        .from("empresas")
        .select("evolution_instance")
        .eq("id", data.empresa_id)
        .maybeSingle();

      if (empErr) {
        const message = empErr.message ?? String(empErr);
        showError("Não foi possível recuperar o nome da instância: " + message);
        setTestResult({
          ok: false,
          message: "Erro ao buscar empresa: " + message,
        });
        return;
      }

      instanceName = (empresaRow as any)?.evolution_instance ?? null;
    }

    if (!instanceName) {
      showError("Nome da instância não definido (whatsapp_instance_name / evolution_instance).");
      return;
    }

    const url = `https://evo.eurekmind.com/instance/connectionState/${encodeURIComponent(instanceName)}`;

    setTesting(true);
    try {
      const resp = await fetch(url, {
        method: "GET",
        headers: {
          apikey: apiKey,
          Accept: "application/json",
        },
      });

      const contentType = resp.headers.get("content-type") ?? "";
      let body: unknown = null;
      if (contentType.includes("application/json")) {
        body = await resp.json();
      } else {
        body = await resp.text();
      }

      if (resp.ok) {
        showSuccess("Conexão Evolution verificada com sucesso.");
        setTestResult({
          ok: true,
          status: resp.status,
          body,
        });
      } else {
        showError(`Falha na verificação (status ${resp.status}).`);
        setTestResult({
          ok: false,
          status: resp.status,
          body,
        });
      }
    } catch (err: any) {
      const message = err?.message ?? String(err);
      showError("Erro ao testar conexão: " + message);
      setTestResult({
        ok: false,
        message,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white/80 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Evolution Config</h2>
          <p className="text-xs text-slate-500">Integração com instância Evolution e número exibido no painel.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="whatsapp_instance_name" className="text-sm font-semibold text-slate-700">
            Nome da instância
          </Label>
          <Input
            id="whatsapp_instance_name"
            placeholder="marcenaria-silva"
            className="mt-2 rounded-xl border-slate-200 bg-white"
            {...register("whatsapp_instance_name")}
          />
          <p className="mt-1 text-xs text-slate-500">
            Deve coincidir com o identificador configurado na Evolution API.
          </p>
        </div>

        <div>
          <Label htmlFor="whatsapp_number_display" className="text-sm font-semibold text-slate-700">
            Número exibido no painel
          </Label>
          <Input
            id="whatsapp_number_display"
            placeholder="+55 11 99999-9999"
            className="mt-2 rounded-xl border-slate-200 bg-white"
            {...register("whatsapp_number_display")}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-end">
        <div>
          <Label htmlFor="evolution_apikey" className="text-sm font-semibold text-slate-700">
            Evolution API Key
          </Label>
          <Input
            id="evolution_apikey"
            type="password"
            placeholder="••••••••"
            className="mt-2 rounded-xl border-slate-200 bg-white"
            {...register("evolution_apikey")}
          />
          <p className="mt-1 text-xs text-slate-500">
            Usada para autenticar chamadas para a Evolution API.
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2 md:items-end">
          <Button
            type="button"
            onClick={testEvolutionConnection}
            disabled={testing}
            className="mt-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testando conexão Evolution...
              </>
            ) : (
              "Testar Conexão Evolution"
            )}
          </Button>
        </div>
      </div>

      {testResult && (
        <div
          className={`mt-3 rounded-2xl border p-3 ${
            testResult.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <p className="text-sm font-semibold">
            Resultado do teste Evolution:{" "}
            {testResult.ok ? "Conexão OK" : "Falha na conexão"}
            {testResult.status ? ` (status ${testResult.status})` : ""}
          </p>
          <pre className="mt-2 max-h-60 overflow-auto text-xs">
            {testResult.body
              ? JSON.stringify(testResult.body, null, 2)
              : testResult.message ?? "Sem detalhes adicionais."}
          </pre>
        </div>
      )}
    </section>
  );
};

export default EvolutionConfig;