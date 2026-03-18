import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("[create-client-user] Missing Supabase configuration.");
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) {
    console.error("[create-client-user] Missing authorization token.");
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const { data: sessionData, error: sessionError } = await adminClient.auth.getUser(token);

  if (sessionError || !sessionData?.user) {
    console.error("[create-client-user] Unable to verify caller.", { error: sessionError });
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const role = (sessionData?.user?.app_metadata as Record<string, unknown> | undefined)?.app_role;
  if (role !== "admin") {
    console.warn("[create-client-user] Caller lacks admin role.");
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  let payload: Record<string, unknown>;

  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch (error) {
    console.error("[create-client-user] Invalid JSON payload.", { error });
    return new Response("Bad request", { status: 400, headers: corsHeaders });
  }

  const email = (payload.email as string | undefined)?.trim().toLowerCase();
  const password = payload.password as string | undefined;
  const rawCompanyId = payload.company_id ?? payload.empresa_id;
  const companyName = (payload.company_name as string | undefined)?.trim();
  const companyId = typeof rawCompanyId === "number"
    ? rawCompanyId
    : typeof rawCompanyId === "string"
      ? Number(rawCompanyId)
      : NaN;

  if (!email || !email.includes("@")) {
    return new Response("Informe um e-mail válido.", { status: 400, headers: corsHeaders });
  }

  if (!password || password.length < 8) {
    return new Response("Informe uma senha com pelo menos 8 caracteres.", { status: 400, headers: corsHeaders });
  }

  if (!companyId || Number.isNaN(companyId)) {
    return new Response("Empresa inválida.", { status: 400, headers: corsHeaders });
  }

  console.log("[create-client-user] Creating client user", { email, companyId });

  const { data: createdUser, error: creationError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      company_id: companyId,
      company_name: companyName,
    },
    app_metadata: {
      app_role: "empresa",
    },
  });

  if (creationError || !createdUser?.user) {
    console.error("[create-client-user] Failed to create auth user.", { error: creationError });
    const message = creationError?.message ?? "Erro ao criar usuário.";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[create-client-user] Linking user to company", { userId: createdUser.user.id, companyId });

  const { error: linkError } = await adminClient.from("user_empresas").insert({
    user_id: createdUser.user!.id,
    empresa_id: companyId,
    role: "member",
  });

  if (linkError) {
    console.error("[create-client-user] Failed to link to user_empresas.", { error: linkError });
    return new Response(JSON.stringify({ error: "Erro ao vincular usuário à empresa." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    user_id: createdUser.user!.id,
    email: createdUser.user!.email,
  }), {
    status: 201,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
