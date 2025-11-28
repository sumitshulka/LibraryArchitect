import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import DashboardPage from "@/modules/dashboard/DashboardPage";
import CatalogPage from "@/modules/catalog/CatalogPage";
import UsersPage from "@/modules/users/UsersPage";
import CirculationPage from "@/modules/circulation/CirculationPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/catalog" component={CatalogPage} />
      <Route path="/users" component={UsersPage} />
      <Route path="/circulation" component={CirculationPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
