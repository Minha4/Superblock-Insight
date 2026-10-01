import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import NotFound from "@/pages/NotFound";
import AnalyticsStudio from "@/pages/AnalyticsStudio";
import Customers from "@/pages/Customers";
import CustomerDetail from "@/pages/CustomerDetail";
import Users from "@/pages/Users";
import Usage from "@/pages/Usage";
import { Invoices, ProductsPlans, Subscriptions, Team } from "@/pages/Management";
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import { AppProvider } from "@/contexts/AppContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedRoute component={AnalyticsStudio} />} />
      <Route path="/analytics" component={() => <ProtectedRoute component={AnalyticsStudio} />} />
      <Route path="/customers" component={() => <ProtectedRoute component={Customers} />} />
      <Route path="/customers/:id" component={() => <ProtectedRoute component={CustomerDetail} />} />
      <Route path="/users" component={() => <ProtectedRoute component={Users} />} />
      <Route path="/usage" component={() => <ProtectedRoute component={Usage} />} />
      <Route path="/subscriptions" component={() => <ProtectedRoute component={Subscriptions} />} />
      <Route path="/products" component={() => <ProtectedRoute component={ProductsPlans} />} />
      <Route path="/plans" component={() => <ProtectedRoute component={ProductsPlans} />} />
      <Route path="/invoices" component={() => <ProtectedRoute component={Invoices} />} />
      <Route path="/billing" component={() => <ProtectedRoute component={Invoices} />} />
      <Route path="/team" component={() => <ProtectedRoute component={Team} />} />
      <Route path="/management" component={() => <ProtectedRoute component={Team} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppProvider>
          <TooltipProvider delayDuration={180}>
            <Router />
            <Toaster position="bottom-right" richColors closeButton />
          </TooltipProvider>
        </AppProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
