import { Switch, Route, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CurrencyProvider } from "@/lib/useCurrency";
import NotFound from "@/pages/not-found";
import DashboardPage from "@/modules/dashboard/DashboardPage";
import CatalogPage from "@/modules/catalog/CatalogPage";
import AddResourcePage from "@/modules/catalog/AddResourcePage";
import BulkUploadPage from "@/modules/catalog/BulkUploadPage";
import AllocationsPage from "@/modules/allocations/AllocationsPage";
import UsersPage from "@/modules/users/UsersPage";
import CirculationPage from "@/modules/circulation/CirculationPage";
import InventoryPage from "@/modules/inventory/InventoryPage";
import OrganizationsPage from "@/modules/organizations/OrganizationsPage";
import { LibraryDashboardPage } from "@/modules/organizations/LibraryDashboardPage";
import { LibraryResourcesPage } from "@/modules/organizations/LibraryResourcesPage";
import ReportsPage from "@/modules/reports/ReportsPage";
import SettingsPage from "@/modules/settings/SettingsPage";
import SSOTestingPage from "./modules/settings/SSOTestingPage";
import PublicHomePage from "./pages/PublicHomePage";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/home" component={PublicHomePage} />
      <Route path="/catalog" component={CatalogPage} />
      <Route path="/catalog/new" component={AddResourcePage} />
      <Route path="/catalog/bulk-upload" component={BulkUploadPage} />
      <Route path="/allocations" component={AllocationsPage} />
      <Route path="/users" component={UsersPage} />
      <Route path="/circulation" component={CirculationPage} />
      <Route path="/inventory" component={InventoryPage} />
      <Route path="/organizations" component={OrganizationsPage} />
      <Route path="/organizations/libraries/:libraryId" component={LibraryDashboardPage} />
      <Route path="/organizations/libraries/:libraryId/resources" component={LibraryResourcesPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/settings/sso-testing" component={SSOTestingPage} />
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
            <AppRouter />
          </WouterRouter>
        </TooltipProvider>
      </CurrencyProvider>
    </QueryClientProvider>
  );
}

export default App;
