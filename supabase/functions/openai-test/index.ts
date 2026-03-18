/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore: Remote import for Deno runtime; allow project TypeScript to skip resolution
// deno-lint-ignore-file no-explicit-any
// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req: any) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    console.warn("[openai-test] Invalid method", { method: req.method });
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  if (!OPENAI_API_KEY) {
    console.error("[openai-test] Missing OPENAI_API_KEY secret");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  try {
    const { model, prompt } = await req.json();

    if (!model || !prompt) {
      return new Response(JSON.stringify({ error: "Missing 'model' or 'prompt'" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    console.log(`[openai-test] Testing model ${model} with prompt length ${prompt.length}`);
    
    // As novas gerações de modelos (o1, o3, "gpt-5.1") não usam max_tokens, mas sim max_completion_tokens.
    const isReasoningModel = model.startsWith("o1") || model.startsWith("o3") || model.includes("5.1");
    
    const payload: any = {
      model,
      messages: [
        { role: "user", content: prompt }
      ],
    };

    if (isReasoningModel) {
      payload.max_completion_tokens = 150;
    } else {
      payload.max_tokens = 150;
    }

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    const contentType = resp.headers.get("content-type") ?? "";

    if (!resp.ok) {
      console.error("[openai-test] OpenAI responded with error", { status: resp.status, body: text });
      let parseErr: any;
      try { parseErr = JSON.parse(text); } catch { /* ignore */ }
      const errMsg = parseErr?.error?.message || parseErr?.error || "OpenAI error";
      
      return new Response(JSON.stringify({ 
        error: typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg),
        status: resp.status, 
        message: text 
      }), {
        status: 502,
        headers: corsHeaders,
      });
    }

    let json: any = null;
    if (contentType.includes("application/json")) {
      json = JSON.parse(text);
    } else {
      json = JSON.parse(text); // fallback
    }

    const reply = json.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ assistant: reply, raw: json }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    console.error("[openai-test] Unexpected error", { error: String(err) });
    return new Response(JSON.stringify({ error: "Unexpected server error", message: String(err) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
