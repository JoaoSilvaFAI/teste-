import { ReactNode, useMemo } from "react";
import { NavLink } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useCompanies } from "@/hooks/use-companies";
import UserPill from "@/components/layout/user-pill";
import { useAuth } from "@/auth/auth-provider";
import {
  LucideIcon,
  Activity,
  CalendarDays,
  MessageCircle,
  FileText,
  Settings,
  Building2,
} from "lucide-react";

const navItems: {
  to: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}[] = [
  { to: "/dashboard", label: "Dashboard", icon: Activity },
  { to: "/agenda", label: "Agenda de Visitas", icon: CalendarDays },
  { to: "/chats", label: "Conversas IA", icon: MessageCircle },
  { to: "/financeiro", label: "Orçamentos & Vendas", icon: FileText },
  { to: "/empresas", label: "Empresas", icon: Building2, adminOnly: true },
  { to: "/settings", label: "Configurações", icon: Settings },
];

const MasterLayout = ({ children }: { children: ReactNode }) => {
  const { isAdmin } = useAuth();
  const { data: companies, isLoading } = useCompanies();
  const activeCompany = isAdmin ? null : companies?.[0];

  const companyName = isAdmin
    ? "Dono do SaaS (Admin)"
    : activeCompany?.nome_fantasia ??
      (isLoading ? "Sincronizando empresa..." : "Cadastre sua primeira empresa");

  const instanceLabel = isAdmin
    ? "Acesso total"
    : activeCompany?.evolution_instance ?? "Instância não configurada";

  const documentLabel = isAdmin
    ? "Todas as empresas"
    : activeCompany?.cpf_cnpj ?? "Documento não cadastrado";

  const baseUrlLabel =
    !isAdmin && activeCompany?.evolution_base_url
      ? activeCompany.evolution_base_url.replace(/^https?:\/\//, "")
      : isAdmin
        ? "admin"
        : null;

  const companyInitials = isAdmin
    ? "AD"
    : activeCompany?.nome_fantasia
      ? activeCompany.nome_fantasia
          .split(" ")
          .map((word) => word[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : "FX";

  const filteredNavItems = useMemo(() => {
    return navItems.filter(item => !item.adminOnly || isAdmin);
  }, [isAdmin]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="w-full border-b border-slate-200 bg-slate-950 text-white lg:h-screen lg:w-64 lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col px-6 py-6 lg:py-8">
            <div className="mb-6 flex items-center justify-between text-base font-semibold">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  {instanceLabel}
                </p>
                <p className="text-lg font-semibold text-white">{companyName}</p>
                <p className="text-xs text-slate-400">{documentLabel}</p>
              </div>
              <p className="text-xs text-teal-400">{baseUrlLabel ?? "beta"}</p>
            </div>

            <nav className="hidden flex-1 flex-col gap-2 lg:flex">
              {filteredNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                      isActive
                        ? "bg-teal-500/10 text-teal-400"
                        : "text-slate-100 hover:bg-slate-800",
                    )
                  }
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="mt-4 flex items-center justify-between text-sm text-slate-400 lg:hidden">
              <p className="uppercase tracking-[0.3em]">Menu</p>
              <span className="text-xs text-teal-300">↺</span>
            </div>

            <nav className="mt-4 flex items-center gap-3 overflow-x-auto rounded-2xl border border-slate-800 px-2 py-3 text-xs font-semibold text-slate-200 lg:hidden">
              {filteredNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex min-w-[140px] items-center gap-2 rounded-2xl px-3 py-2 transition",
                      isActive
                        ? "bg-teal-500/20 text-teal-300"
                        : "hover:bg-slate-800",
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="mt-auto hidden lg:block">
              <Badge className="rounded-full bg-teal-100 text-teal-600">
                {isAdmin
                  ? "Admin com acesso total"
                  : activeCompany
                    ? `Instância ${instanceLabel}`
                    : "Sem empresa ativa"}
              </Badge>
              <p className="mt-2 text-xs text-slate-400">
                {isAdmin
                  ? "Você pode auditar e gerenciar todas as empresas."
                  : activeCompany
                    ? "Monitoramento constante das conversas e visitas."
                    : "Cadastre sua primeira empresa para liberar o painel."}
              </p>
            </div>
          </div>
        </aside>

        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-6 py-4 shadow-sm backdrop-blur lg:px-8">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  {isAdmin
                    ? "Bem-vindo, Admin!"
                    : activeCompany
                      ? `Bem-vindo, ${activeCompany.nome_fantasia}!`
                      : "Bem-vindo!"}
                </p>
                <p className="text-xl font-semibold text-slate-900">
                  {isAdmin
                    ? "Painel do Dono do SaaS"
                    : activeCompany
                      ? "Painel de Operações"
                      : "Ative sua operação"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="rounded-full bg-teal-100 text-teal-600">
                  {isAdmin
                    ? "RLS: bypass admin"
                    : baseUrlLabel
                      ? `API: ${baseUrlLabel}`
                      : "Configure a Evolution API"}
                </Badge>

                <UserPill />

                <Button variant="ghost" className="rounded-full px-3 py-2">
                  <Avatar>
                    <AvatarFallback>{companyInitials}</AvatarFallback>
                  </Avatar>
                </Button>
              </div>
            </div>
            <div className="mt-3 hidden gap-2 text-xs font-semibold text-slate-500 lg:flex">
              {filteredNavItems.map((item) => (
                <NavLink
                  key={`header-${item.to}`}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "rounded-full px-3 py-1 transition hover:bg-slate-100",
                      isActive ? "bg-slate-100 text-slate-900" : "text-slate-500",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default MasterLayout;