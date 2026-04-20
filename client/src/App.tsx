import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CurrencyProvider } from "@/lib/useCurrency";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/modules/dashboard/DashboardPage";
import CatalogPage from "@/modules/catalog/CatalogPage";
import AddResourcePage from "@/modules/catalog/AddResourcePage";
import BulkUploadPage from "@/modules/catalog/BulkUploadPage";
import AllocationsPage from "@/modules/allocations/AllocationsPage";
import UsersPage from "@/modules/users/UsersPage";
import CirculationPage from "@/modules/circulation/CirculationPage";
import WaiverRequestsPage from "@/modules/circulation/WaiverRequestsPage";
import InventoryPage from "@/modules/inventory/InventoryPage";
import OrganizationsPage from "@/modules/organizations/OrganizationsPage";
import { LibraryDashboardPage } from "@/modules/organizations/LibraryDashboardPage";
import { LibraryResourcesPage } from "@/modules/organizations/LibraryResourcesPage";
import ReportsPage from "@/modules/reports/ReportsPage";
import AuditLogsPage from "@/modules/reports/AuditLogsPage";
import SettingsPage from "@/modules/settings/SettingsPage";
import SSOTestingPage from "./modules/settings/SSOTestingPage";
import SearchAttributesPage from "./modules/catalog/SearchAttributesPage";
import PublicHomePage from "./pages/PublicHomePage";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/home" component={PublicHomePage} />
      <Route path="/">{() => <ProtectedRoute component={DashboardPage} />}</Route>
      <Route path="/dashboard">{() => <ProtectedRoute component={DashboardPage} />}</Route>
      <Route path="/catalog">{() => <ProtectedRoute component={CatalogPage} />}</Route>
      <Route path="/catalog/new">{() => <ProtectedRoute component={AddResourcePage} />}</Route>
      <Route path="/catalog/bulk-upload">{() => <ProtectedRoute component={BulkUploadPage} />}</Route>
      <Route path="/catalog/search-attributes">{() => <ProtectedRoute component={SearchAttributesPage} />}</Route>
      <Route path="/allocations">{() => <ProtectedRoute component={AllocationsPage} />}</Route>
      <Route path="/users">{() => <ProtectedRoute component={UsersPage} />}</Route>
      <Route path="/circulation">{() => <ProtectedRoute component={CirculationPage} />}</Route>
      <Route path="/circulation/waiver-requests">{() => <ProtectedRoute component={WaiverRequestsPage} />}</Route>
      <Route path="/inventory">{() => <ProtectedRoute component={InventoryPage} />}</Route>
      <Route path="/organizations">{() => <ProtectedRoute component={OrganizationsPage} />}</Route>
      <Route path="/organizations/libraries/:libraryId">{() => <ProtectedRoute component={LibraryDashboardPage} />}</Route>
      <Route path="/organizations/libraries/:libraryId/resources">{() => <ProtectedRoute component={LibraryResourcesPage} />}</Route>
      <Route path="/reports">{() => <ProtectedRoute component={ReportsPage} />}</Route>
      <Route path="/audit-logs">{() => <ProtectedRoute component={AuditLogsPage} />}</Route>
      <Route path="/settings">{() => <ProtectedRoute component={SettingsPage} />}</Route>
      <Route path="/settings/sso-testing">{() => <ProtectedRoute component={SSOTestingPage} />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CurrencyProvider>
        <TooltipProvider>
          <Toaster />
          <SonnerToaster position="top-right" />
          <WouterRouter>
            <AuthProvider>
              <AppRouter />
            </AuthProvider>
          </WouterRouter>
        </TooltipProvider>
      </CurrencyProvider>
    </QueryClientProvider>
  );
}

export default App;
