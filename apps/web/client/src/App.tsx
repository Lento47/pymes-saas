import { Loader2 } from "lucide-react";
import { Switch, Route, Router, Redirect } from "wouter";
import { useWorkspaceHashLocation, normalizeInitialLocation } from "@/hooks/use-workspace-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/sidebar";
import { AppErrorBoundary } from "@/components/shared/app-error-boundary";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { useAuth } from "@/hooks/use-auth";

import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Register from "@/pages/register";
import AcceptInvite from "@/pages/accept-invite";
import Pricing from "@/pages/pricing";
import ProductPage from "@/pages/product";
import SeoLandingPage from "@/pages/seo-landing-page";
import Dashboard from "@/pages/dashboard";
import Inbox from "@/pages/inbox";
import Contacts from "@/pages/contacts";
import ContactDetail from "@/pages/contact-detail";
import Tasks from "@/pages/tasks";
import Documents from "@/pages/documents";
import Invoices from "@/pages/invoices";
import Automations from "@/pages/automations";
import Notifications from "@/pages/notifications";
import Pipeline from "@/pages/pipeline";
import WorkspaceSettingsPage from "@/pages/settings/workspace";
import MembersSettingsPage from "@/pages/settings/members";
import ChannelsSettingsPage from "@/pages/settings/channels";
import DepartmentsSettingsPage from "@/pages/settings/departments";
import IntegrationsSettingsPage from "@/pages/settings/integrations";
import AiSettingsPage from "@/pages/settings/ai";
import CreditsSettingsPage from "@/pages/settings/credits";
import PlatformSettingsPage from "@/pages/settings/platform";
import Billing from "@/pages/billing";
import HelpPage from "@/pages/help";
import HelpDocumentPage from "@/pages/help-document";
import DocumentationCenterPage from "@/pages/documentation";
import DocumentationDocumentPage from "@/pages/documentation-document";
import { LegalCenterPage, LegalDocumentPage } from "@/pages/legal-center";
import PlatformPage from "@/pages/platform";
import WorkflowsPage from "@/pages/workflows";
import InsightsPage from "@/pages/insights-page";
import SecurityPage from "@/pages/security-page";
import NotFound from "@/pages/not-found";
import Chat from "@/pages/chat";
import Agent from "@/pages/agent";
import OnboardingPage from "@/pages/onboarding";
import SetupPage from "@/pages/setup";
import SupportPage from "@/pages/support";
import InventoryPage from "@/pages/inventory";
import InventoryDetailPage from "@/pages/inventory-detail";
import InventoryMovementsPage from "@/pages/inventory-movements";
import AdminDashboard from "@/pages/admin/dashboard";
import { NoindexMeta } from "@/components/shared/noindex-meta";
import AdminWorkspaces from "@/pages/admin/workspaces";
import AdminWorkspaceDetail from "@/pages/admin/workspace-detail";
import AdminUsers from "@/pages/admin/users";
import AdminPlanLimits from "@/pages/admin/plan-limits";
import AdminLogin from "@/pages/admin/login";
import AdminLandingEditor from "@/pages/admin/landing-editor";
import BusinessProfilePage from "@/pages/business-profile";

function AppLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-3">
      <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      <span className="text-muted-foreground text-sm">Cargando...</span>
    </div>
  );
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, initialized, user } = useAuth();
  if (!initialized || (isAuthenticated && !user)) return <AppLoader />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <AppSidebar>{children}</AppSidebar>;
}

function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, initialized } = useAuth();
  if (!initialized || (isAuthenticated && !user)) return <AppLoader />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (!user?.is_platform_admin) return <Redirect to="/" />;
  return <AppSidebar>{children}</AppSidebar>;
}

function RootRoute() {
  const { isAuthenticated, user, initialized } = useAuth();
  if (!initialized || (isAuthenticated && !user)) return <AppLoader />;
  if (!isAuthenticated) return <Landing />;
  return <ProtectedLayout><Dashboard /></ProtectedLayout>;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/accept-invite" component={AcceptInvite} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/setup" component={SetupPage} />
      <Route path="/product">
        {() => <ProductPage />}
      </Route>
      <Route path="/whatsapp-shared-inbox">
        {() => <SeoLandingPage slug="whatsapp-shared-inbox" />}
      </Route>
      <Route path="/crm-for-smbs">
        {() => <SeoLandingPage slug="crm-for-smbs" />}
      </Route>
      <Route path="/client-management">
        {() => <SeoLandingPage slug="client-management" />}
      </Route>
      <Route path="/workflow-automation">
        {() => <SeoLandingPage slug="workflow-automation" />}
      </Route>
      <Route path="/whatsapp-crm">
        {() => <SeoLandingPage slug="whatsapp-crm" />}
      </Route>
      <Route path="/invoicing">
        {() => <SeoLandingPage slug="invoicing" />}
      </Route>
      <Route path="/team-inbox">
        {() => <SeoLandingPage slug="team-inbox" />}
      </Route>
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
      <Route path="/platform">
        {() => <PlatformPage />}
      </Route>
      <Route path="/workflows">
        {() => <WorkflowsPage />}
      </Route>
      <Route path="/insights">
        {() => <InsightsPage />}
      </Route>
      <Route path="/security">
        {() => <SecurityPage />}
      </Route>
      <Route path="/">
        {() => <RootRoute />}
      </Route>
      <Route path="/inbox">
        {() => <ProtectedLayout><Inbox /></ProtectedLayout>}
      </Route>
      <Route path="/inbox/:id">
        {() => <ProtectedLayout><Inbox /></ProtectedLayout>}
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
      <Route path="/notifications">
        {() => <ProtectedLayout><Notifications /></ProtectedLayout>}
      </Route>
      <Route path="/chat">
        {() => <ProtectedLayout><Chat /></ProtectedLayout>}
      </Route>
      <Route path="/agent">
        {() => <ProtectedLayout><Agent /></ProtectedLayout>}
      </Route>
      <Route path="/support">
        {() => <ProtectedLayout><SupportPage /></ProtectedLayout>}
      </Route>
      <Route path="/inventory">
        {() => <ProtectedLayout><InventoryPage /></ProtectedLayout>}
      </Route>
      <Route path="/inventory/movements">
        {() => <ProtectedLayout><InventoryMovementsPage /></ProtectedLayout>}
      </Route>
      <Route path="/inventory/:id">
        {(params) => <ProtectedLayout><InventoryDetailPage /></ProtectedLayout>}
      </Route>
      <Route path="/pipeline">
        {() => <ProtectedLayout><Pipeline /></ProtectedLayout>}
      </Route>
      <Route path="/settings">
        {() => <Redirect to="/settings/workspace" />}
      </Route>
      <Route path="/settings/workspace">
        {() => <ProtectedLayout><WorkspaceSettingsPage /></ProtectedLayout>}
      </Route>
      <Route path="/settings/members">
        {() => <ProtectedLayout><MembersSettingsPage /></ProtectedLayout>}
      </Route>
      <Route path="/settings/channels">
        {() => <ProtectedLayout><ChannelsSettingsPage /></ProtectedLayout>}
      </Route>
      <Route path="/settings/departments">
        {() => <ProtectedLayout><DepartmentsSettingsPage /></ProtectedLayout>}
      </Route>
      <Route path="/settings/integrations">
        {() => <ProtectedLayout><IntegrationsSettingsPage /></ProtectedLayout>}
      </Route>
      <Route path="/settings/ai">
        {() => <ProtectedLayout><AiSettingsPage /></ProtectedLayout>}
      </Route>
      <Route path="/settings/credits">
        {() => <ProtectedLayout><CreditsSettingsPage /></ProtectedLayout>}
      </Route>
      <Route path="/settings/platform">
        {() => <ProtectedLayout><PlatformSettingsPage /></ProtectedLayout>}
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
        {() => <PlatformAdminLayout><AdminWorkspaceDetail /></PlatformAdminLayout>}
      </Route>
      <Route path="/admin/users">
        {() => <PlatformAdminLayout><AdminUsers /></PlatformAdminLayout>}
      </Route>
      <Route path="/admin/plan-limits">
        {() => <PlatformAdminLayout><AdminPlanLimits /></PlatformAdminLayout>}
      </Route>
      <Route path="/admin/landing">
        {() => <PlatformAdminLayout><AdminLandingEditor /></PlatformAdminLayout>}
      </Route>
      <Route path="/help">
        {() => <ProtectedLayout><HelpPage /></ProtectedLayout>}
      </Route>
      <Route path="/help/:slug">
        {(params) => <ProtectedLayout><HelpDocumentPage slug={params.slug} /></ProtectedLayout>}
      </Route>
      <Route path="/onboarding">
        {() => <ProtectedLayout><OnboardingPage /></ProtectedLayout>}
      </Route>
      <Route path="/business-profile">
        {() => <BusinessProfilePage />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  normalizeInitialLocation();

  return (
    <AppErrorBoundary>
      <NoindexMeta />
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <ThemeProvider>
            <TooltipProvider>
              <Toaster />
              <Router hook={useWorkspaceHashLocation}>
                <AppRouter />
                <OfflineBanner />
              </Router>
            </TooltipProvider>
          </ThemeProvider>
        </I18nProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}