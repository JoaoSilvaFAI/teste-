import { useMemo } from "react";
import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/auth/auth-provider";
import { ShieldCheck } from "lucide-react";

const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/90 shadow-lg shadow-slate-200/80">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900">Autorizando acesso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-500">
            <p>Verificando se você possui o papel de Dono do SaaS.</p>
            <Alert className="rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
              <AlertDescription>Só será possível prosseguir após a sessão ser validada.</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="w-full max-w-xl rounded-3xl border border-rose-200 bg-white/90 shadow-lg shadow-rose-200/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Badge className="rounded-full bg-rose-100 text-rose-700">
                <ShieldCheck className="h-3 w-3" /> Acesso restrito
              </Badge>
              <CardTitle className="text-lg font-semibold text-slate-900">Somente para o Dono do SaaS</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-500">
            <p>
              Este módulo está reservado exclusivamente ao app_role <span className="font-mono">admin</span>.
              Solicite a atribuição do papel ao usuário ou acesse o painel principal.
            </p>
            <Alert className="rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
              <AlertDescription>
                Você está autenticado, mas não tem permissão para cadastrar novas empresas.
              </AlertDescription>
            </Alert>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold"
                onClick={() => navigate("/dashboard")}
              >
                Voltar ao Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminRoute;
