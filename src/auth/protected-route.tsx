import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/auth/auth-provider";

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] w-full rounded-3xl border border-slate-200 bg-white/80 p-8 text-left shadow-lg shadow-slate-200/50">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
          Autenticação
        </p>
        <p className="mt-3 text-2xl font-semibold text-slate-900">
          Verificando sessão…
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Só um instante para garantir seu acesso seguro.
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;