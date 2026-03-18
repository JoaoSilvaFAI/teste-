import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MasterLayout from "@/components/layout/master-layout";
import DashboardPage from "@/app/dashboard/page";
import AgendaPage from "@/app/agenda/page";
import ChatsPage from "@/app/chats/page";
import FinanceiroPage from "@/app/financeiro/page";
import SettingsPage from "@/app/settings/page";
import CompaniesPage from "@/pages/Companies";
import NotFound from "./pages/NotFound";
import LoginPage from "@/pages/Login";
import ProtectedRoute from "@/auth/protected-route";
import AdminRoute from "@/auth/admin-route";
import { AuthProvider } from "@/auth/auth-provider";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <MasterLayout>
                      <DashboardPage />
                    </MasterLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/agenda"
                element={
                  <ProtectedRoute>
                    <MasterLayout>
                      <AgendaPage />
                    </MasterLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chats"
                element={
                  <ProtectedRoute>
                    <MasterLayout>
                      <ChatsPage />
                    </MasterLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/financeiro"
                element={
                  <ProtectedRoute>
                    <MasterLayout>
                      <FinanceiroPage />
                    </MasterLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/empresas"
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <MasterLayout>
                        <CompaniesPage />
                      </MasterLayout>
                    </AdminRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <MasterLayout>
                      <SettingsPage />
                    </MasterLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="*"
                element={
                  <ProtectedRoute>
                    <MasterLayout>
                      <NotFound />
                    </MasterLayout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
