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
import Invoices from "@/pages/invoices";
import Automations from "@/pages/automations";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <AppSidebar>{children}</AppSidebar>;
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
