import { useState } from 'react';
import { useLocation } from 'wouter';
import { KeyRound, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.requestPasswordReset(email.trim());
      setSent(true);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Error al enviar el email.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" strokeWidth={1.5} />
        <div>
          <h2 className="text-base font-semibold text-foreground">Revisá tu email</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Si ese email existe, recibirás un enlace para restablecer tu contraseña.
          </p>
        </div>
        <a href="#/login" className="text-xs text-accent hover:underline">Volver al ingreso</a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Olvidé mi contraseña</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ingresá tu email y te enviamos un enlace para restablecer tu contraseña.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="tu@empresa.com"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar enlace'}
      </Button>
      <div className="text-center">
        <a href="#/login" className="text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Volver al ingreso
        </a>
      </div>
    </form>
  );
}

function ResetPassword({ token }: { token: string }) {
  const [, navigate] = useLocation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    setLoading(true);
    setError('');
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Token inválido o expirado.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" strokeWidth={1.5} />
        <div>
          <h2 className="text-base font-semibold text-foreground">Contraseña actualizada</h2>
          <p className="mt-1 text-sm text-muted-foreground">Ya podés ingresar con tu nueva contraseña.</p>
        </div>
        <Button className="w-full" onClick={() => navigate('/login')}>Ingresar</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Nueva contraseña</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mínimo 12 caracteres, con mayúscula, minúscula, número y carácter especial.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={12}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirmar contraseña</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={12}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar contraseña'}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get('token') ??
    new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('token');

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 border border-accent/20">
            <KeyRound className="h-5 w-5 text-accent" strokeWidth={1.75} />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {token ? <ResetPassword token={token} /> : <ForgotPassword />}
        </div>
      </div>
    </div>
  );
}
