import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch } from 'wouter';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/login" component={LoginPage} />
      </Switch>
    </QueryClientProvider>
  );
}
