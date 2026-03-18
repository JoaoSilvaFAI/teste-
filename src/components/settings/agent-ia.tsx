import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOpenAIModels, type OpenAIModel } from "@/hooks/use-openai-models";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2 } from "lucide-react";

const EDGE_TEST_URL = "https://bgghkwvqtpnsgdpqzrqz.supabase.co/functions/v1/openai-test";

type AgentIAProps = {
  testResult: {
    ok: boolean;
    assistant?: string;
    raw?: unknown;
    status?: number;
    message?: string;
  } | null;
  setTestResult: (result: {
    ok: boolean;
    assistant?: string;
    raw?: unknown;
    status?: number;
    message?: string;
  } | null) => void;
  testing: boolean;
  setTesting: (testing: boolean) => void;
};

const AgentIA = ({
  testResult,
  setTestResult,
  testing,
  setTesting,
}: AgentIAProps) => {
  const { register, getValues, setValue, watch } = useFormContext();
  const { data: models, isLoading: loadingModels, isError: modelsError } = useOpenAIModels();

  const selectedModelValue = watch("openai_model");

  const testOpenAIModel = async (modelParam?: string) => {
    setTestResult(null);

    const selectedModel = (modelParam ?? selectedModelValue) || undefined;
    if (!selectedModel) {
      showError("Selecione um modelo OpenAI antes de testar.");
      return;
    }

    setTesting(true);
    try {
      const resp = await fetch(EDGE_TEST_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          prompt: "Olá! Responda com um texto curto confirmando que você é capaz de processar este modelo.",
        }),
      });

      const contentType = resp.headers.get("content-type") ?? "";
      let body: any = null;
      if (contentType.includes("application/json")) {
        body = await resp.json();
      } else {
        body = await resp.text();
      }

      if (resp.ok) {
        setTestResult({
          ok: true,
          assistant: body.assistant ?? null,
          raw: body.raw ?? null,
          status: resp.status,
        });
        showSuccess("Teste do modelo executado com sucesso.");
      } else {
        setTestResult({
          ok: false,
          message: body?.error ?? "Falha ao testar modelo",
          status: resp.status,
        });
        showError("Falha ao testar modelo OpenAI.");
      }
    } catch (err: any) {
      const message = err?.message ?? String(err);
      setTestResult({
        ok: false,
        message,
      });
      showError("Erro ao testar modelo OpenAI: " + message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white/80 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Agente IA</h2>
          <p className="text-xs text-slate-500">Selecione o modelo e organize o prompt do agente IA.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-end">
        <div>
          <Label htmlFor="openai_model" className="text-sm font-semibold text-slate-700">
            Modelo IA
          </Label>
          <div className="mt-2">
            {loadingModels ? (
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                Carregando modelos...
              </div>
            ) : modelsError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                Não foi possível carregar modelos da Edge Function.
              </div>
            ) : (
              <Select
                value={selectedModelValue || ""}
                onValueChange={(value) => {
                  setValue("openai_model", value, {
                    shouldDirty: true,
                  });
                  if (value) {
                    testOpenAIModel(value);
                  }
                }}
              >
                <SelectTrigger className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <SelectValue placeholder="(Nenhum modelo selecionado)" />
                </SelectTrigger>
                <SelectContent>
                  {(models ?? []).map((m: OpenAIModel) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <input type="hidden" {...register("openai_model")} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Lista carregada da Edge Function com os modelos ativos.
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2 md:items-end">
          <Button
            type="button"
            onClick={() => testOpenAIModel()}
            disabled={testing}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testando modelo IA...
              </>
            ) : (
              "Testar Modelo IA"
            )}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1 text-xs text-slate-500">
          <span>Prompt atual (interno)</span>
          <span className="font-mono text-[10px] text-slate-400">
            prompt_sistema_base / prompt_personalizacao
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-full border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
        >
          Personalização do Prompt
        </Button>
      </div>

      {/* Campos de prompt ocultos */}
      <div className="hidden">
        <textarea {...register("prompt_sistema_base")} />
        <textarea {...register("prompt_personalizacao")} />
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
            Resultado do teste modelo IA:{" "}
            {testResult.ok ? "OK" : "Falha"}
            {testResult.status ? ` (status ${testResult.status})` : ""}
          </p>
          {testResult.assistant && (
            <pre className="mt-2 whitespace-pre-wrap text-sm">
              {testResult.assistant}
            </pre>
          )}
          {!testResult.assistant && !!testResult.raw && (
            <pre className="mt-2 max-h-60 overflow-auto text-xs">
              {JSON.stringify(testResult.raw as any, null, 2)}
            </pre>
          )}
          {!testResult.assistant && testResult.message && (
            <p className="mt-2 text-sm">{testResult.message}</p>
          )}
        </div>
      )}
    </section>
  );
};

export default AgentIA;