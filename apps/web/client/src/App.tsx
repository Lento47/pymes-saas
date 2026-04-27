import { Switch, Route, Router, Redirect, useLocation } from "wouter";
import { useEffect } from "react";
import { useWorkspaceHashLocation, normalizeInitialLocation } from "@/hooks/use-workspace-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/sidebar";
import { AppErrorBoundary } from "@/components/shared/app-error-boundary";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { useAuth } from "@/hooks/use-auth";

import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Product from "@/pages/product";
import Platform from "@/pages/platform";
import Workflows from "@/pages/workflows";
import InsightsPage from "@/pages/insights-page";
import SecurityPage from "@/pages/security-page";
import AcceptInvite from "@/pages/accept-invite";
import Pricing from "@/pages/pricing";
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
import Agent from "@/pages/agent";
import Settings from "@/pages/settings";
import Billing from "@/pages/billing";
import HelpPage from "@/pages/help";
import HelpDocumentPage from "@/pages/help-document";
import DocumentationCenterPage from "@/pages/documentation";
import DocumentationDocumentPage from "@/pages/documentation-document";
import { LegalCenterPage, LegalDocumentPage } from "@/pages/legal-center";
import NotFound from "@/pages/not-found";
import ChatPageView from "@/pages/chat";
import AgentPage from "@/pages/agent";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminWorkspaces from "@/pages/admin/workspaces";
import AdminWorkspaceDetail from "@/pages/admin/workspace-detail";
import AdminUsers from "@/pages/admin/users";

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isRestoring, user } = useAuth();
  const [loc] = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [loc]);
  if (isRestoring) return <div className="flex items-center justify-center min-h-screen bg-[#05091d]" />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <AppSidebar>{children}</AppSidebar>;
}

function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isRestoring } = useAuth();
  if (isRestoring) return <div className="flex items-center justify-center min-h-screen bg-[#05091d]" />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <AppSidebar>{children}</AppSidebar>;
}

function RootRoute() {
  const { isAuthenticated, user, isRestoring } = useAuth();
  if (isRestoring) return <div className="flex items-center justify-center min-h-screen bg-[#05091d]" />;
  if (!isAuthenticated) return <Landing />;
  return <ProtectedLayout><Dashboard /></ProtectedLayout>;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/product" component={Product} />
      <Route path="/platform" component={Platform} />
      <Route path="/workflows" component={Workflows} />
      <Route path="/insights" component={InsightsPage} />
      <Route path="/security" component={SecurityPage} />
      <Route path="/accept-invite" component={AcceptInvite} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/documentation">
        {() => <DocumentationCenterPage />}
      </Route>
      <Route path="/documentation/:slug">
        {(params) => <DocumentationDocumentPage slug={params.slug} />}
      </Route>
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
      <Route path="/agent">
        {() => <ProtectedLayout><Agent /></ProtectedLayout>}
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
      <Route path="/admin">
        {() => <PlatformAdminLayout><AdminDashboard /></PlatformAdminLayout>}
      </Route>
      <Route path="/admin/workspaces">
        {() => <PlatformAdminLayout><AdminWorkspaces /></PlatformAdminLayout>}
      </Route>
      <Route path="/admin/workspaces/:slug">
        {(params) => <PlatformAdminLayout><AdminWorkspaceDetail slug={params.slug} /></PlatformAdminLayout>}
      </Route>
      <Route path="/admin/users">
        {() => <PlatformAdminLayout><AdminUsers /></PlatformAdminLayout>}
      </Route>
      <Route path="/help">
        {() => <ProtectedLayout><HelpPage /></ProtectedLayout>}
      </Route>
      <Route path="/help/:slug">
        {(params) => <ProtectedLayout><HelpDocumentPage slug={params.slug} /></ProtectedLayout>}
      </Route>
      <Route path="/chat">
        {() => <ProtectedLayout><ChatPageView /></ProtectedLayout>}
      </Route>
      <Route path="/agent">
        {() => <ProtectedLayout><AgentPage /></ProtectedLayout>}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  normalizeInitialLocation();

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <TooltipProvider>
            <Toaster />
            <Router hook={useWorkspaceHashLocation}>
              <AppRouter />
            </Router>
          </TooltipProvider>
        </I18nProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
