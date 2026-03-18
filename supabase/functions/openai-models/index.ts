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

  if (req.method !== "GET") {
    console.warn("[openai-models] Invalid method", { method: req.method });
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  if (!OPENAI_API_KEY) {
    console.error("[openai-models] Missing OPENAI_API_KEY secret");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  try {
    console.log("[openai-models] Fetching models from OpenAI");
    const resp = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        Accept: "application/json",
      },
    });

    const text = await resp.text();
    const contentType = resp.headers.get("content-type") ?? "";

    if (!resp.ok) {
      console.error("[openai-models] OpenAI responded with error", { status: resp.status, body: text });
      return new Response(JSON.stringify({ error: "OpenAI error", status: resp.status, body: text }), {
        status: 502,
        headers: corsHeaders,
      });
    }

    let json: any = null;
    if (contentType.includes("application/json")) {
      json = JSON.parse(text);
    } else {
      // fallback - try parse
      try {
        json = JSON.parse(text);
      } catch {
        json = { data: [] };
      }
    }

    const raw = Array.isArray(json.data) ? json.data : [];

    // Filter and normalize: keep models starting with "gpt" (adjust as desired)
    const models = raw
      .map((m: any) => ({ id: String(m.id ?? m.name ?? ""), raw: m }))
      .filter((m: any) => m.id.startsWith("gpt"))
      .map((m: any) => ({ id: m.id }));

    console.log("[openai-models] Returning models count", { count: models.length });

    return new Response(JSON.stringify({ models }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    console.error("[openai-models] Unexpected error", { error: String(err) });
    return new Response(JSON.stringify({ error: "Unexpected server error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});