import { useLocation } from 'wouter';

export function DashboardPage() {
  const [, navigate] = useLocation();

  return (
    <div style={{ padding: 24 }}>
      <h1>Dashboard</h1>
      <p>Bienvenido a PyMeHub Desktop.</p>
      <button onClick={() => navigate('/login')}>Cerrar sesión</button>
    </div>
  );
}
