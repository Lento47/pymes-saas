import { Switch, Route, Router, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/hooks/use-auth";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Inbox from "@/pages/inbox";
import Conversation from "@/pages/conversation";
import Contacts from "@/pages/contacts";
import ContactDetail from "@/pages/contact-detail";
import Tasks from "@/pages/tasks";
import Documents from "@/pages/documents";
import Automations from "@/pages/automations";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect to="/login" />;
  return (
    <div className="flex h-screen bg-[#0d0f14] text-[#e2e8f0] overflow-hidden">
      <AppSidebar>{null}</AppSidebar>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        {() => <ProtectedLayout><Dashboard /></ProtectedLayout>}
      </Route>
      <Route path="/inbox">
        {() => <ProtectedLayout><Inbox /></ProtectedLayout>}
      </Route>
      <Route path="/inbox/:id">
        {(params: any) => <ProtectedLayout><Conversation id={params.id} /></ProtectedLayout>}
      </Route>
      <Route path="/contacts">
        {() => <ProtectedLayout><Contacts /></ProtectedLayout>}
      </Route>
      <Route path="/contacts/:id">
        {(params: any) => <ProtectedLayout><ContactDetail id={params.id} /></ProtectedLayout>}
      </Route>
      <Route path="/tasks">
        {() => <ProtectedLayout><Tasks /></ProtectedLayout>}
      </Route>
      <Route path="/documents">
        {() => <ProtectedLayout><Documents /></ProtectedLayout>}
      </Route>
      <Route path="/automations">
        {() => <ProtectedLayout><Automations /></ProtectedLayout>}
      </Route>
      <Route path="/settings">
        {() => <ProtectedLayout><Settings /></ProtectedLayout>}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
