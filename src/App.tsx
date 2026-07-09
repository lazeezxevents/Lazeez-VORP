import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/vendors/ProtectedRoute";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import SplashScreen from "@/components/ui/SplashScreen";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Vendors from "@/pages/Vendors";
import VendorDetail from "@/pages/VendorDetail";
import Issues from "@/pages/Issues";
import MOUs from "@/pages/MOUs";
import MOUVault from "@/pages/MOUVault";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";
import AuditLogs from "@/pages/AuditLogs";
import Notifications from "@/pages/Notifications";
import Calendar from "@/pages/Calendar";
import NotFound from "@/pages/NotFound";
import UserApprovals from "@/pages/UserApprovals";
import HRPerformance from "@/components/pages/HRPerformance";
import ProjectBoard from "@/components/projects/ProjectBoard";
import ApprovalPending from "@/pages/ApprovalPending";
import SetPassword from "@/pages/SetPassword";
import InvitationManagement from "@/components/hr/InvitationManagement";
import Archive from "@/pages/Archive";
import Error500 from "@/pages/Error500";
import Error403 from "@/pages/Error403";
import Finance from "@/pages/Finance";
import Communication from "@/pages/Communication";
import { DashboardLayout } from "@/components/layout";
import { Component, ErrorInfo, ReactNode } from "react";

const queryClient = new QueryClient();

// Error Boundary Component
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 space-y-4">
            <h1 className="text-2xl font-bold text-red-600">Something went wrong</h1>
            <p className="text-gray-600">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-60">
              {this.state.error?.stack}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-primary text-white py-2 px-4 rounded hover:bg-primary/90"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <ErrorBoundary>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AuthProvider>
                <Routes>
                  <Route path="/" element={<Login />} />
                  <Route path="/approval-pending" element={<ApprovalPending />} />
                  <Route path="/set-password/:token" element={<SetPassword />} />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/vendors"
                    element={
                      <ProtectedRoute>
                        <Vendors />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/vendors/:id"
                    element={
                      <ProtectedRoute>
                        <VendorDetail />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/issues"
                    element={
                      <ProtectedRoute>
                        <Issues />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/mous"
                    element={
                      <ProtectedRoute>
                        <MOUs />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/mou-vault"
                    element={
                      <ProtectedRoute>
                        <MOUVault />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/analytics"
                    element={
                      <ProtectedRoute>
                        <Analytics />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/audit-logs"
                    element={
                      <ProtectedRoute>
                        <AuditLogs />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/notifications"
                    element={
                      <ProtectedRoute>
                        <Notifications />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/user-approvals"
                    element={
                      <ProtectedRoute requireAdmin>
                        <UserApprovals />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/hr-performance"
                    element={
                      <ProtectedRoute requireStaff>
                        <HRPerformance />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/projects"
                    element={
                      <ProtectedRoute>
                        <ProjectBoard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/calendar"
                    element={
                      <ProtectedRoute>
                        <Calendar />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute>
                        <Settings />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/invitations"
                    element={
                      <ProtectedRoute requireStaff>
                        <DashboardLayout>
                          <InvitationManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/archive"
                    element={
                      <ProtectedRoute>
                        <Archive />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/finance"
                    element={
                      <ProtectedRoute requireStaff>
                        <Finance />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/communication"
                    element={
                      <ProtectedRoute>
                        <Communication />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/error/500" element={<Error500 />} />
                  <Route path="/error/403" element={<Error403 />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
