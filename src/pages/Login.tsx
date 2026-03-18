import { useEffect, useMemo } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/auth-provider";
import { Badge } from "@/components/ui/badge";

type LocationState = {
  from?: { pathname?: string };
};

const LoginPage = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState | null) ?? null;

  const redirectTo = useMemo(() => {
    return state?.from?.pathname && state.from.pathname !== "/login"
      ? state.from.pathname
      : "/dashboard";
  }, [state]);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, redirectTo]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 gap-6 px-4 py-8 lg:grid-cols-2 lg:items-center lg:gap-10 lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-7 shadow-xl shadow-slate-200/60 lg:p-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">
                Portal SaaS
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-900">
                Entrar no sistema
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Faça login para acessar dashboard, empresas e configurações com
                segurança por empresa.
              </p>
            </div>

            <Badge className="rounded-full bg-teal-100 px-4 py-2 text-teal-700">
              Multi-tenant
            </Badge>
          </div>

          <div className="mt-7 rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
            <Auth
              supabaseClient={supabase}
              providers={[]}
              appearance={{
                theme: ThemeSupa,
                style: {
                  button: {
                    borderRadius: "999px",
                    height: "48px",
                    fontWeight: 700,
                  },
                  input: {
                    borderRadius: "16px",
                    height: "44px",
                  },
                  label: {
                    fontWeight: 700,
                    color: "#334155",
                  },
                  anchor: {
                    color: "#0f766e",
                    fontWeight: 700,
                  },
                  message: {
                    color: "#475569",
                  },
                  container: {
                    width: "100%",
                  },
                },
                variables: {
                  default: {
                    colors: {
                      brand: "#0f766e",
                      brandAccent: "#115e59",
                      inputBorder: "#e2e8f0",
                      inputBorderHover: "#94a3b8",
                      inputBorderFocus: "#0f766e",
                    },
                  },
                },
              }}
              theme="light"
            />
          </div>

          <p className="mt-4 text-xs text-slate-400">
            Dica: para “Dono do SaaS”, defina <span className="font-mono">app_metadata.app_role</span>{" "}
            como <span className="font-mono">admin</span> no usuário do Supabase.
          </p>
        </div>

        <div className="rounded-3xl bg-slate-950 p-8 text-left text-white shadow-2xl shadow-slate-900/20 lg:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">
            Acesso por empresa
          </p>
          <h2 className="mt-3 text-3xl font-semibold">
            Controle total, sem misturar dados
          </h2>
          <p className="mt-3 text-sm text-slate-300">
            Usuários comuns enxergam apenas as empresas vinculadas. O Admin do
            SaaS pode auditar tudo, criar empresas e ajustar configurações.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
              <p className="text-sm font-semibold text-white">Operação</p>
              <p className="mt-2 text-xs text-slate-300">
                Dashboard com atendimentos, visitas, vendas e agenda.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
              <p className="text-sm font-semibold text-white">Admin</p>
              <p className="mt-2 text-xs text-slate-300">
                Acesso total via policies (RLS) com claim de admin.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
              Segurança
            </p>
            <p className="mt-2 text-sm text-slate-200">
              Todas as tabelas ficam com RLS ativo + policies por <span className="font-mono">empresa_id</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;