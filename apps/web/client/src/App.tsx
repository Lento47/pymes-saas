import React, { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Switch, Route, Router, Redirect, useLocation } from "wouter";
import { useWorkspaceHashLocation, normalizeInitialLocation } from "@/hooks/use-workspace-location";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/sidebar";
import { AppErrorBoundary } from "@/components/shared/app-error-boundary";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { DisplayPreferencesProvider, useDisplayPreferences } from "@/components/providers/display-preferences";
import AccountPage from "@/pages/account";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { CallProvider, useCallContext } from "@/features/calls/CallProvider";
import { IncomingCallDialog } from "@/features/calls/IncomingCallDialog";
import { ActiveCallBar } from "@/features/calls/ActiveCallBar";
import { CallErrorFallback } from "@/features/calls/CallErrorFallback";
import { CallPage } from "@/features/calls/CallPage";

import AcceptInvite from "@/pages/accept-invite";
import VerifyEmail from "@/pages/verify-email";
import ResetPassword from "@/pages/reset-password";
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
import TemplatesSettingsPage from "@/pages/settings/templates";
import AuditLogPage from "@/pages/settings/audit";
import PlatformSettingsPage from "@/pages/settings/platform";
import Billing from "@/pages/billing";
import HelpPage from "@/pages/help";
import HelpCenterPage from "@/pages/help-center";
import HelpDocumentPage from "@/pages/help-document";
import DocumentationCenterPage from "@/pages/documentation";
import DocumentationDocumentPage from "@/pages/documentation-document";
import { LegalCenterPage, LegalDocumentPage } from "@/pages/legal-center";
import DataRequestPage from "@/pages/data-request";
import AccessibilityPage from "@/pages/accessibility";
import PlatformPage from "@/pages/marketing/platform-page";
import AiAgentsPage from "@/pages/marketing/ai-agents-page";
import BillingMarketingPage from "@/pages/marketing/billing-page";
import WorkflowsPage from "@/pages/workflows";
import InsightsPage from "@/pages/insights-page";
import SecurityPage from "@/pages/marketing/security-page";
import NotFound from "@/pages/not-found";
import Chat from "@/pages/chat";
import Agent from "@/pages/agent";
import OnboardingPage from "@/pages/onboarding";
import SetupPage from "@/pages/setup";
import SupportPage from "@/pages/support";
import InventoryPage from "@/pages/inventory";
import InventoryDetailPage from "@/pages/inventory-detail";
import InventoryMovementsPage from "@/pages/inventory-movements";
import AgentsPage from "@/pages/agents/AgentsPage";
import AgentDetailPage from "@/pages/agents/AgentDetailPage";
import AgentTemplatesPage from "@/pages/agents/AgentTemplatesPage";
import PlaybookSuggestionsPage from "@/pages/agents/PlaybookSuggestionsPage";
import SolutionPage from "@/pages/solutions/SolutionPage";
import ComingSoonPage from "@/pages/coming-soon";
import { NoindexMeta } from "@/components/shared/noindex-meta";
import AdminConsolePage from "@/pages/admin/console";
import BusinessProfilePage from "@/pages/business-profile";
import MapPage from "@/pages/map";
import MarketplaceHomePage from "@/pages/marketplace/home";
import MarketplaceCategoriesPage from "@/pages/marketplace/categories";
import MarketplaceCategoryPage from "@/pages/marketplace/category";
import MarketplaceSearchPage from "@/pages/marketplace/search";
import MarketplaceStorePage from "@/pages/marketplace/store";
import MarketplaceProductPage from "@/pages/marketplace/product";
import MarketplaceCartPage from "@/pages/marketplace/cart";
import MarketplaceCheckoutPage from "@/pages/marketplace/checkout";
import MarketplaceOrdersPage from "@/pages/marketplace/orders";
import MarketplaceOrderPage from "@/pages/marketplace/order";
import MarketplaceFavoritesPage from "@/pages/marketplace/favorites";
import MarketplaceSignInPage from "@/pages/marketplace/sign-in";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location]);
  return null;
}

function AppLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-3">
      <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      <span className="text-muted-foreground text-sm">Cargando...</span>
    </div>
  );
}

function EmailVerificationBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [resent, setResent] = React.useState(false);

  if (!user || user.email_verified !== false || dismissed) return null;

  const handleResend = async () => {
    setResending(true);
    try {
      // Was `await import("@/lib/api")`. About eighty other files import this module
      // statically, so the dynamic form never split anything — it only made this one
      // call site look as though it had. Now that `api` is imported at the top of this
      // file, the indirection is gone rather than left alongside its own replacement.
      await api.resendVerificationEmail();
      setResent(true);
    } catch {
      // ignore
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-700">
      <span>
        Verificá tu email para acceder a todas las funciones.{' '}
        {resent ? (
          <span className="font-medium">Revisá tu bandeja de entrada.</span>
        ) : (
          <button
            onClick={handleResend}
            disabled={resending}
            className="font-medium underline underline-offset-2 hover:no-underline disabled:opacity-50"
          >
            {resending ? 'Enviando…' : 'Reenviar email'}
          </button>
        )}
      </span>
      <button onClick={() => setDismissed(true)} className="shrink-0 opacity-60 hover:opacity-100 text-amber-700 leading-none">✕</button>
    </div>
  );
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, initialized, user } = useAuth();
  if (!initialized || (isAuthenticated && !user)) return <AppLoader />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return (
    <CallProvider>
      <EmailVerificationBanner />
      <AppSidebar>{children}</AppSidebar>
      <CallOverlays />
    </CallProvider>
  );
}

function CallOverlays() {
  return (
    <>
      <IncomingCallDialog />
      <ActiveCallBar />
      <CallErrorFallback />
    </>
  );
}


/**
 * `PlatformAdminLayout` is gone with the pages it wrapped.
 *
 * It polled `api.getMe()` on a 60s timer behind `useAuth()`, and its reason for existing
 * was sound — `JwtStrategy` re-reads `is_platform_admin` on every request, so a layout
 * trusting a stale snapshot would keep rendering admin chrome for an operator who had just
 * been demoted. The reasoning was right and the thing it guarded no longer exists: those
 * pages all spoke `/api/*`, which nothing serves.
 *
 * The console does not need it. `pages/admin/console.tsx` carries `AdminGate`, which reads
 * `users.me` over trpc — the same `isAdmin` the Worker's `adminProcedure` checks, so the
 * client gate and the server gate cannot disagree.
 */

function RootRoute() {
  const { isAuthenticated, user, initialized } = useAuth();
  if (!initialized || (isAuthenticated && !user)) return <AppLoader />;
  // A stranger lands on the marketplace storefront, not a product pitch. This is the
  // public version of PymesHub: browse shops and products, then sign in to order.
  if (!isAuthenticated) return <MarketplaceHomePage />;
  return <ProtectedLayout><Dashboard /></ProtectedLayout>;
}

function makeFeatureRoute(slug: string, AppComp: React.ComponentType) {
  return function FeatureRoute() {
    const { isAuthenticated, user, initialized } = useAuth();
    if (!initialized || (isAuthenticated && !user)) return <AppLoader />;
    if (!isAuthenticated) {
      // These routes are the authenticated app's own pages. A stranger lands on
      // the storefront — the CRM-era feature marketing that used to render here
      // described a product PymesHub no longer is.
      return <Redirect to="/" />;
    }
    return <AppSidebar><AppComp /></AppSidebar>;
  };
}

const InboxFeatureRoute     = makeFeatureRoute("inbox",       Inbox);
const CrmFeatureRoute       = makeFeatureRoute("crm",         Contacts);
const TasksFeatureRoute     = makeFeatureRoute("tasks",       Tasks);
const DocumentsFeatureRoute = makeFeatureRoute("documents",   Documents);
const BillingFeatureRoute   = makeFeatureRoute("billing",     Invoices);
const AutomationsFeatureRoute = makeFeatureRoute("automations", Automations);

function AppRouter() {
  const [location] = useLocation();
  const { reducedMotion } = useDisplayPreferences();
  const systemReducedMotion = useReducedMotion();
  const reduceMotion = reducedMotion || systemReducedMotion;
  const pageKey = "/" + (location.split("/")[1] ?? "");

  return (
    <motion.div
      key={pageKey}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
    >
    <Switch>
      <Route path="/login">{() => <MarketplaceSignInPage initialMode="sign-in" />}</Route>
      <Route path="/register">{() => <MarketplaceSignInPage initialMode="sign-up" />}</Route>
      <Route path="/accept-invite" component={AcceptInvite} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/forgot-password" component={ResetPassword} />
      <Route path="/pricing" component={Pricing} />
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
      <Route path="/solutions/small-teams">
        {() => <SolutionPage slug="small-teams" />}
      </Route>
      <Route path="/solutions/retail">
        {() => <SolutionPage slug="retail" />}
      </Route>
      <Route path="/solutions/services">
        {() => <SolutionPage slug="services" />}
      </Route>
      <Route path="/solutions/agencies">
        {() => <SolutionPage slug="agencies" />}
      </Route>
      <Route path="/solutions/ecommerce">
        {() => <SolutionPage slug="ecommerce" />}
      </Route>
      <Route path="/about">{() => <ComingSoonPage eyebrow="Empresa" title="Sobre PymesHub" description="Conocé al equipo detrás de PymesHub: nuestra misión, historia y valores." />}</Route>
      <Route path="/customers">{() => <ComingSoonPage eyebrow="Clientes" title="Casos de éxito" description="Descubrí cómo empresas como la tuya usan PymesHub para crecer y atender mejor." />}</Route>
      <Route path="/careers">{() => <ComingSoonPage eyebrow="Carreras" title="Únete al equipo" description="Buscamos personas apasionadas por construir software que cambia la vida de las PYMEs." />}</Route>
      <Route path="/press">{() => <ComingSoonPage eyebrow="Prensa" title="PymesHub en los medios" description="Recursos, logos y contacto para periodistas y comunicadores." />}</Route>
      <Route path="/blog">{() => <ComingSoonPage eyebrow="Blog" title="Recursos y artículos" description="Guías para vender en línea, organizar tu catálogo y entregar mejor en tu barrio." />}</Route>
      <Route path="/community">{() => <ComingSoonPage eyebrow="Comunidad" title="Comunidad PymesHub" description="Conectá con otros dueños de empresas, comparte tips y aprende de la experiencia colectiva." />}</Route>
      <Route path="/changelog">{() => <ComingSoonPage eyebrow="Novedades" title="Cambios y actualizaciones" description="Todo lo nuevo en PymesHub: funciones lanzadas, mejoras y correcciones." />}</Route>
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
      <Route path="/data-request">
        {() => <DataRequestPage />}
      </Route>
      <Route path="/accessibility">
        {() => <AccessibilityPage />}
      </Route>
      <Route path="/platform">
        {() => <PlatformPage />}
      </Route>
      <Route path="/ai-agents">
        {() => <AiAgentsPage />}
      </Route>
      <Route path="/billing-workflows">
        {() => <BillingMarketingPage />}
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
      <Route path="/map">
        {() => <MapPage />}
      </Route>
      <Route path="/crm" component={CrmFeatureRoute} />
      {/*
       * `/analytics` used to be a `makeFeatureRoute` wrapping the *marketing* insights
       * page — so a signed-in user arriving there got a landing page inside `AppSidebar`,
       * and a signed-out one was redirected to the storefront. It was a vestige: the
       * marketing nav links to `/insights` (the same component, correctly public and
       * unguarded), nothing anywhere in the app linked here, and there has never been an
       * `analytics.tsx`. Redirect rather than delete, so an old bookmark or an external
       * link lands on the real page instead of a 404.
       */}
      <Route path="/analytics">
        {() => <Redirect to="/insights" />}
      </Route>
      <Route path="/">
        {() => <RootRoute />}
      </Route>
      <Route path="/inbox" component={InboxFeatureRoute} />
      <Route path="/inbox/:id">
        {() => <ProtectedLayout><Inbox /></ProtectedLayout>}
      </Route>
      <Route path="/contacts">
        {() => <ProtectedLayout><Contacts /></ProtectedLayout>}
      </Route>
      <Route path="/contacts/:id">
        {() => <ProtectedLayout><ContactDetail /></ProtectedLayout>}
      </Route>
      <Route path="/calls/:id">
        {() => <ProtectedLayout><CallPage /></ProtectedLayout>}
      </Route>
      <Route path="/tasks" component={TasksFeatureRoute} />
      <Route path="/documents" component={DocumentsFeatureRoute} />
      <Route path="/billing" component={BillingFeatureRoute} />
      <Route path="/invoices">
        {() => <ProtectedLayout><Invoices /></ProtectedLayout>}
      </Route>
      <Route path="/automations" component={AutomationsFeatureRoute} />
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
      <Route path="/help-center">
        {() => <ProtectedLayout><HelpCenterPage /></ProtectedLayout>}
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
      <Route path="/agents/templates">
        {() => <ProtectedLayout><AgentTemplatesPage /></ProtectedLayout>}
      </Route>
      <Route path="/agents/playbooks">
        {() => <ProtectedLayout><PlaybookSuggestionsPage /></ProtectedLayout>}
      </Route>
      <Route path="/agents/:id">
        {(params) => <ProtectedLayout><AgentDetailPage id={params.id!} /></ProtectedLayout>}
      </Route>
      <Route path="/agents">
        {() => <ProtectedLayout><AgentsPage /></ProtectedLayout>}
      </Route>
      <Route path="/pipeline">
        {() => <ProtectedLayout><Pipeline /></ProtectedLayout>}
      </Route>
      <Route path="/settings">
        {() => <Redirect to="/settings/workspace" />}
      </Route>
      <Route path="/account/:section?">
        {(params) => <ProtectedLayout><AccountPage section={params.section} /></ProtectedLayout>}
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
      <Route path="/settings/templates">
        {() => <ProtectedLayout><TemplatesSettingsPage /></ProtectedLayout>}
      </Route>
      <Route path="/settings/audit">
        {() => <ProtectedLayout><AuditLogPage /></ProtectedLayout>}
      </Route>
      <Route path="/settings/platform">
        {() => <ProtectedLayout><PlatformSettingsPage /></ProtectedLayout>}
      </Route>
      <Route path="/settings/billing">
        {() => <ProtectedLayout><Billing /></ProtectedLayout>}
      </Route>
      <Route path="/admin">
        {/*
          `/admin` forwards to the platform console, and it is now the **only** admin route.

          The seven that sat here — workspaces, users, plan limits, the landing editor, SaaS
          support, router metrics — are deleted, and they are gone because there was nothing
          behind them. They all spoke `/api/*`, which is the NestJS service in `apps/api`.
          That service is not deployed: Railway is gone, the marketplace Worker at
          `api.pymeshub.lat` mounts `/trpc`, `/auth`, `/uploads` and nothing under `/api/*`,
          and `api.pymeshub.com` does not resolve. Every one of those pages was a guaranteed
          404, and the browser reported it as a CORS failure because a 404 carries no
          `Access-Control-Allow-Origin`.

          **A previous version of this comment claimed the opposite** — that the SaaS API was
          deployed and the pages were fine, on the strength of `apps/api/railway.json`,
          `deploy-railway.yml` and `.env.production.example`. All three are stale files, not
          deployment. That claim was wrong, and it is recorded here because it is the kind of
          wrong that keeps dead code alive: I read it, believed it, and spent several commits
          reasoning from it before a DNS lookup settled it.

          `PlatformAdminLayout` went with them. It gated on `useAuth()` → `api.getMe()`, so it
          was not a shell around live pages but a second way to reach a dead one.

          The console carries its own `AdminGate` instead, reading `users.me` over trpc — the
          same `isAdmin` the Worker's `adminProcedure` checks, so the two cannot disagree.
        */}
        {() => <Redirect to="/admin/console" />}
      </Route>
      {/*
        The platform console on the marketplace API, and now the only `/admin` route.

        **Two routes, because the tabs are addressable.** `/admin/console` and
        `/admin/console/:tab` render the same component; the second is what the sidebar and
        the tab strip point at, so a tab can be linked, bookmarked and reached with the back
        button. They used to be one route with the tab held in component state, which meant
        no link to "Cobros" could be shared and the back button left the console entirely.

        `:tab` is validated against the console's own tab list and rewritten to the default
        if it names nothing real, so a hand-edited or stale URL lands somewhere useful
        instead of an empty page. No route names a tab here on purpose — the list is the
        console's, and duplicating it would be the two-lists problem back again.
      */}
      <Route path="/admin/console" component={AdminConsolePage} />
      <Route path="/admin/console/:tab" component={AdminConsolePage} />
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

      {/* Customer marketplace — the public storefront. */}
      <Route path="/categories" component={MarketplaceCategoriesPage} />
      <Route path="/category/:slug">
        {(params) => <MarketplaceCategoryPage slug={params.slug!} />}
      </Route>
      <Route path="/search" component={MarketplaceSearchPage} />
      <Route path="/store/:slug">
        {(params) => <MarketplaceStorePage slug={params.slug!} />}
      </Route>
      <Route path="/product/:id">
        {(params) => <MarketplaceProductPage id={params.id!} />}
      </Route>
      <Route path="/cart" component={MarketplaceCartPage} />
      <Route path="/checkout" component={MarketplaceCheckoutPage} />
      <Route path="/orders" component={MarketplaceOrdersPage} />
      <Route path="/order/:id">
        {(params) => <MarketplaceOrderPage id={params.id!} />}
      </Route>
      <Route path="/favorites" component={MarketplaceFavoritesPage} />
      <Route path="/sign-in">{() => <MarketplaceSignInPage initialMode="sign-in" />}</Route>

      <Route component={NotFound} />
    </Switch>
    </motion.div>
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
            <DisplayPreferencesProvider>
            <TooltipProvider>
              <Toaster />
              <Router hook={useWorkspaceHashLocation}>
                <ScrollToTop />
                <AppRouter />
                <OfflineBanner />
              </Router>
            </TooltipProvider>
            </DisplayPreferencesProvider>
          </ThemeProvider>
        </I18nProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
