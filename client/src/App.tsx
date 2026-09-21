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
import InventoryImportPage from "@/modules/inventory/InventoryImportPage";
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
import StudentDashboardPage from "@/modules/patron/StudentDashboardPage";
import MyLoansPage from "@/modules/patron/MyLoansPage";
import MyFinesPage from "@/modules/patron/MyFinesPage";
import MyHistoryPage from "@/modules/patron/MyHistoryPage";

function ProtectedRoute({
  component: Component,
  localAdminOnly = false,
  staffOnly = false,
  patronOnly = false,
}: {
  component: React.ComponentType;
  localAdminOnly?: boolean;
  staffOnly?: boolean;
  patronOnly?: boolean;
}) {
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

  if (localAdminOnly && (user?.role !== "ADMIN" || !user.isLocalUser)) {
    return <Redirect to="/" />;
  }
  if (staffOnly && user?.category === "PATRON") return <Redirect to="/" />;
  if (patronOnly && user?.category !== "PATRON") return <Redirect to="/" />;

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
    location === "/libraries"
  ) {
    return <Redirect to={`/organizations/libraries/${libraryAccess.libraries[0].id}`} />;
  }

  return <Component />;
}

function RoleDashboardPage() {
  const { user } = useAuth();
  return user?.category === "PATRON" ? <StudentDashboardPage /> : <DashboardPage />;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/setup-password" component={PasswordSetupPage} />
      <Route path="/home" component={PublicHomePage} />
      <Route path="/">{() => <ProtectedRoute component={RoleDashboardPage} />}</Route>
      <Route path="/dashboard">{() => <ProtectedRoute component={RoleDashboardPage} />}</Route>
      <Route path="/my-loans">{() => <ProtectedRoute component={MyLoansPage} patronOnly />}</Route>
      <Route path="/my-fines">{() => <ProtectedRoute component={MyFinesPage} patronOnly />}</Route>
      <Route path="/my-history">{() => <ProtectedRoute component={MyHistoryPage} patronOnly />}</Route>
      <Route path="/libraries">{() => <ProtectedRoute component={LibrariesPage} staffOnly />}</Route>
      <Route path="/catalog">{() => <ProtectedRoute component={CatalogPage} />}</Route>
      <Route path="/catalog/new">{() => <ProtectedRoute component={AddResourcePage} localAdminOnly />}</Route>
      <Route path="/catalog/bulk-upload">{() => <ProtectedRoute component={BulkUploadPage} localAdminOnly />}</Route>
      <Route path="/catalog/search-attributes">{() => <ProtectedRoute component={SearchAttributesPage} localAdminOnly />}</Route>
      <Route path="/catalog/search-attributes/bulk-assign">{() => <ProtectedRoute component={BulkAssignAttributesPage} localAdminOnly />}</Route>
      <Route path="/digital-resources">{() => <ProtectedRoute component={DigitalResourcesDashboardPage} staffOnly />}</Route>
      <Route path="/digital-resources/repository">{() => <ProtectedRoute component={RepositoryPage} staffOnly />}</Route>
      <Route path="/digital-resources/upload">{() => <ProtectedRoute component={UploadResourcePage} staffOnly />}</Route>
      <Route path="/digital-resources/:id">{() => <ProtectedRoute component={ResourceDetailsPage} staffOnly />}</Route>
      <Route path="/allocations">{() => <ProtectedRoute component={AllocationsPage} localAdminOnly />}</Route>
      <Route path="/users">{() => <ProtectedRoute component={UsersPage} staffOnly />}</Route>
      <Route path="/circulation">{() => <ProtectedRoute component={CirculationPage} staffOnly />}</Route>
      <Route path="/circulation/waiver-requests">{() => <ProtectedRoute component={WaiverRequestsPage} staffOnly />}</Route>
      <Route path="/circulation/pending-fines">{() => <ProtectedRoute component={PendingFinesPage} staffOnly />}</Route>
      <Route path="/reservations">{() => <ProtectedRoute component={ReservationsPage} />}</Route>
      <Route path="/lost-damaged">{() => <ProtectedRoute component={LostDamagedPage} staffOnly />}</Route>
      <Route path="/inventory">{() => <ProtectedRoute component={InventoryPage} staffOnly />}</Route>
      <Route path="/admin/inventory-import">{() => <ProtectedRoute component={InventoryImportPage} localAdminOnly />}</Route>
      <Route path="/organizations">{() => <ProtectedRoute component={OrganizationsPage} staffOnly />}</Route>
      <Route path="/organizations/libraries/:libraryId">{() => <ProtectedRoute component={LibraryDashboardPage} staffOnly />}</Route>
      <Route path="/organizations/libraries/:libraryId/resources">{() => <ProtectedRoute component={LibraryResourcesPage} staffOnly />}</Route>
      <Route path="/reports">{() => <ProtectedRoute component={ReportsPage} staffOnly />}</Route>
      <Route path="/audit-logs">{() => <ProtectedRoute component={AuditLogsPage} staffOnly />}</Route>
      <Route path="/messages">{() => <ProtectedRoute component={MessagesPage} staffOnly />}</Route>
      <Route path="/settings">{() => <ProtectedRoute component={SettingsPage} staffOnly />}</Route>
      <Route path="/settings/sso-testing">{() => <ProtectedRoute component={SSOTestingPage} staffOnly />}</Route>
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
