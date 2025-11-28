import { Switch, Route, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import DashboardPage from "@/modules/dashboard/DashboardPage";
import CatalogPage from "@/modules/catalog/CatalogPage";
import AddResourcePage from "@/modules/catalog/AddResourcePage";
import AllocationsPage from "@/modules/allocations/AllocationsPage";
import UsersPage from "@/modules/users/UsersPage";
import CirculationPage from "@/modules/circulation/CirculationPage";
import InventoryPage from "@/modules/inventory/InventoryPage";
import OrganizationsPage from "@/modules/organizations/OrganizationsPage";
import { LibraryDashboardPage } from "@/modules/organizations/LibraryDashboardPage";
import ReportsPage from "@/modules/reports/ReportsPage";
import SettingsPage from "@/modules/settings/SettingsPage";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/catalog" component={CatalogPage} />
      <Route path="/catalog/new" component={AddResourcePage} />
      <Route path="/allocations" component={AllocationsPage} />
      <Route path="/users" component={UsersPage} />
      <Route path="/circulation" component={CirculationPage} />
      <Route path="/inventory" component={InventoryPage} />
      <Route path="/organizations" component={OrganizationsPage} />
      <Route path="/organizations/libraries/:libraryId" component={LibraryDashboardPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <SonnerToaster position="top-right" />
        <WouterRouter>
          <AppRouter />
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
