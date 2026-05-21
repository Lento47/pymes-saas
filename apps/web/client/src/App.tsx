import { Switch, Route, Router, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/sidebar";
import { AppErrorBoundary } from "@/components/shared/app-error-boundary";
import { ThemeProvider } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";

import Landing from "@/pages/landing";
import Login from "@/pages/login";
import AcceptInvite from "@/pages/accept-invite";
import Dashboard from "@/pages/dashboard";
import Inbox from "@/pages/inbox";
import Conversation from "@/pages/conversation";
import Contacts from "@/pages/contacts";
import ContactDetail from "@/pages/contact-detail";
import Tasks from "@/pages/tasks";
import Documents from "@/pages/documents";
import Invoices from "@/pages/invoices";
import Automations from "@/pages/automations";
import Pipeline from "@/pages/pipeline";
import Settings from "@/pages/settings";
import Billing from "@/pages/billing";
import HelpPage from "@/pages/help";
import HelpDocumentPage from "@/pages/help-document";
import { LegalCenterPage, LegalDocumentPage } from "@/pages/legal-center";
import NotFound from "@/pages/not-found";
import Register from "@/pages/register";
import Onboarding from "@/pages/onboarding";
import Admin from "@/pages/admin";

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <AppSidebar>{children}</AppSidebar>;
}

function RootRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? (
    <ProtectedLayout><Dashboard /></ProtectedLayout>
  ) : (
    <Landing />
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/onboarding">
        {() => <Onboarding />}
      </Route>
      <Route path="/admin">
        {() => <Admin />}
      </Route>
      <Route path="/accept-invite" component={AcceptInvite} />
      <Route path="/legal">
        {() => <LegalCenterPage />}
      </Route>
      <Route path="/legal/:slug">
        {(params) => <LegalDocumentPage slug={params.slug} />}
      </Route>
      <Route path="/">
        {() => <RootRoute />}
      </Route>
      <Route path="/inbox">
        {() => <ProtectedLayout><Inbox /></ProtectedLayout>}
      </Route>
      <Route path="/inbox/:id">
        {() => <ProtectedLayout><Conversation /></ProtectedLayout>}
      </Route>
      <Route path="/contacts">
        {() => <ProtectedLayout><Contacts /></ProtectedLayout>}
      </Route>
      <Route path="/contacts/:id">
        {() => <ProtectedLayout><ContactDetail /></ProtectedLayout>}
      </Route>
      <Route path="/tasks">
        {() => <ProtectedLayout><Tasks /></ProtectedLayout>}
      </Route>
      <Route path="/documents">
        {() => <ProtectedLayout><Documents /></ProtectedLayout>}
      </Route>
      <Route path="/invoices">
        {() => <ProtectedLayout><Invoices /></ProtectedLayout>}
      </Route>
      <Route path="/automations">
        {() => <ProtectedLayout><Automations /></ProtectedLayout>}
      </Route>
      <Route path="/pipeline">
        {() => <ProtectedLayout><Pipeline /></ProtectedLayout>}
      </Route>
      <Route path="/settings">
        {() => <ProtectedLayout><Settings /></ProtectedLayout>}
      </Route>
      <Route path="/settings/billing">
        {() => <ProtectedLayout><Billing /></ProtectedLayout>}
      </Route>
      <Route path="/help">
        {() => <ProtectedLayout><HelpPage /></ProtectedLayout>}
      </Route>
      <Route path="/help/:slug">
        {(params) => <ProtectedLayout><HelpDocumentPage slug={params.slug} /></ProtectedLayout>}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <ThemeProvider>
            <Router hook={useHashLocation}>
              <AppRouter />
            </Router>
          </ThemeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
