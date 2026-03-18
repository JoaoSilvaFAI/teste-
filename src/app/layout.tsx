import type { ReactNode } from "react";

const AppLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {children}
    </div>
  );
};

export default AppLayout;
