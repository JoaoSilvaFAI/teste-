import { LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { useAuth } from "@/auth/auth-provider";

const UserPill = () => {
  const { user, isAdmin } = useAuth();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isAdmin && (
        <Badge className="rounded-full bg-fuchsia-100 px-3 py-1 text-fuchsia-700">
          <Shield className="mr-1 h-3.5 w-3.5" />
          Admin do SaaS
        </Badge>
      )}

      <Badge className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
        {user?.email ?? "Usuário"}
      </Badge>

      <Button
        type="button"
        variant="ghost"
        className="h-9 rounded-full px-3 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        onClick={() => supabase.auth.signOut()}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Sair
      </Button>
    </div>
  );
};

export default UserPill;