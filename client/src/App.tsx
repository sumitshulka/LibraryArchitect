import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CurrencyProvider } from "@/lib/useCurrency";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/LoginPage";
import PasswordSetupPage from "@/pages/PasswordSetupPage";
import DashboardPage from "@/modules/dashboard/DashboardPage";
import CatalogPage from "@/modules/catalog/CatalogOverviewPage";
import AddResourcePage from "@/modules/catalog/AddResourcePage";
import BulkUploadPage from "@/modules/catalog/BulkUploadPage";
import AllocationsPage from "@/modules/allocations/AllocationsPage";
import UsersPage from "@/modules/users/UsersPage";
import CirculationPage from "@/modules/circulation/CirculationPage";
import WaiverRequestsPage from "@/modules/circulation/WaiverRequestsPage";
import ReservationsPage from "@/modules/circulation/ReservationsPage";
import LostDamagedPage from "@/modules/circulation/LostDamagedPage";
import PendingFinesPage from "@/modules/circulation/PendingFinesPage";
import InventoryPage from "@/modules/inventory/InventoryPage";
import OrganizationsPage from "@/modules/organizations/OrganizationsPage";
import LibrariesPage from "@/modules/organizations/LibrariesPage";
import { LibraryDashboardPage } from "@/modules/organizations/LibraryDashboardPage";
import { LibraryResourcesPage } from "@/modules/organizations/LibraryResourcesPage";
import ReportsPage from "@/modules/reports/ReportsPage";
import AuditLogsPage from "@/modules/reports/AuditLogsPage";
import SettingsPage from "@/modules/settings/SettingsPage";
import SSOTestingPage from "./modules/settings/SSOTestingPage";
import SearchAttributesPage, { BulkAssignAttributesPage } from "./modules/catalog/SearchAttributesPage";
import PublicHomePage from "./pages/PublicHomePage";
import NoLibraryAccessPage from "./pages/NoLibraryAccessPage";
import MessagesPage from "@/modules/messages/MessagesPage";
import DigitalResourcesDashboardPage from "@/modules/digital-resources/DigitalResourcesDashboardPage";
import RepositoryPage from "@/modules/digital-resources/RepositoryPage";
import UploadResourcePage from "@/modules/digital-resources/UploadResourcePage";
import ResourceDetailsPage from "@/modules/digital-resources/ResourceDetailsPage";
import { Loader2 } from "lucide-react";
import { libraryAccessApi } from "@/lib/api";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const isLibrarian = user?.role === "LIBRARIAN";
  const { data: libraryAccess, isLoading: isLoadingLibraryAccess } = useQuery({
    queryKey: ["library-access"],
    queryFn: libraryAccessApi.getMine,
    enabled: isLibrarian,
    refetchInterval: 15_000,
  });

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

  if (isLibrarian && isLoadingLibraryAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isLibrarian && libraryAccess && !libraryAccess.hasAccess) {
    return <NoLibraryAccessPage />;
  }

  if (
    isLibrarian &&
    libraryAccess?.libraries.length === 1 &&
    (location === "/" || location === "/dashboard")
  ) {
    return <Redirect to={`/organizations/libraries/${libraryAccess.libraries[0].id}`} />;
  }

  return <Component />;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/setup-password" component={PasswordSetupPage} />
      <Route path="/home" component={PublicHomePage} />
      <Route path="/">{() => <ProtectedRoute component={DashboardPage} />}</Route>
      <Route path="/dashboard">{() => <ProtectedRoute component={DashboardPage} />}</Route>
      <Route path="/libraries">{() => <ProtectedRoute component={LibrariesPage} />}</Route>
      <Route path="/catalog">{() => <ProtectedRoute component={CatalogPage} />}</Route>
      <Route path="/catalog/new">{() => <ProtectedRoute component={AddResourcePage} />}</Route>
      <Route path="/catalog/bulk-upload">{() => <ProtectedRoute component={BulkUploadPage} />}</Route>
      <Route path="/catalog/search-attributes">{() => <ProtectedRoute component={SearchAttributesPage} />}</Route>
      <Route path="/catalog/search-attributes/bulk-assign">{() => <ProtectedRoute component={BulkAssignAttributesPage} />}</Route>
      <Route path="/digital-resources">{() => <ProtectedRoute component={DigitalResourcesDashboardPage} />}</Route>
      <Route path="/digital-resources/repository">{() => <ProtectedRoute component={RepositoryPage} />}</Route>
      <Route path="/digital-resources/upload">{() => <ProtectedRoute component={UploadResourcePage} />}</Route>
      <Route path="/digital-resources/:id">{() => <ProtectedRoute component={ResourceDetailsPage} />}</Route>
      <Route path="/allocations">{() => <ProtectedRoute component={AllocationsPage} />}</Route>
      <Route path="/users">{() => <ProtectedRoute component={UsersPage} />}</Route>
      <Route path="/circulation">{() => <ProtectedRoute component={CirculationPage} />}</Route>
      <Route path="/circulation/waiver-requests">{() => <ProtectedRoute component={WaiverRequestsPage} />}</Route>
      <Route path="/circulation/pending-fines">{() => <ProtectedRoute component={PendingFinesPage} />}</Route>
      <Route path="/reservations">{() => <ProtectedRoute component={ReservationsPage} />}</Route>
      <Route path="/lost-damaged">{() => <ProtectedRoute component={LostDamagedPage} />}</Route>
      <Route path="/inventory">{() => <ProtectedRoute component={InventoryPage} />}</Route>
      <Route path="/organizations">{() => <ProtectedRoute component={OrganizationsPage} />}</Route>
      <Route path="/organizations/libraries/:libraryId">{() => <ProtectedRoute component={LibraryDashboardPage} />}</Route>
      <Route path="/organizations/libraries/:libraryId/resources">{() => <ProtectedRoute component={LibraryResourcesPage} />}</Route>
      <Route path="/reports">{() => <ProtectedRoute component={ReportsPage} />}</Route>
      <Route path="/audit-logs">{() => <ProtectedRoute component={AuditLogsPage} />}</Route>
      <Route path="/messages">{() => <ProtectedRoute component={MessagesPage} />}</Route>
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
