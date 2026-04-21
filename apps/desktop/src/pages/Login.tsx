import { useState } from 'react';
import { apiFetch, setAccessToken } from '../lib/api';
import { useLocation } from 'wouter';

export function LoginPage() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await apiFetch<{ access_token: string }>(`/api/auth/${workspace}/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAccessToken(res.access_token);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
        <h1>PyMeHub</h1>
        <input placeholder="Workspace" value={workspace} onChange={e => setWorkspace(e.target.value)} required />
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit">Entrar</button>
      </form>
    </div>
  );
}
