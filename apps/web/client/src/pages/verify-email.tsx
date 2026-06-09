import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

export default function VerifyEmailPage() {
  const [, navigate] = useLocation();
  const token = new URLSearchParams(window.location.search).get('token') ??
    new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('Token de verificación no encontrado en la URL.');
      return;
    }
    api.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err: Error) => {
        setStatus('error');
        setErrorMsg(err.message || 'Token inválido o expirado.');
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-sm w-full rounded-xl border border-border bg-card p-8 space-y-5 text-center shadow-sm">
        {status === 'loading' && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">Verificando tu email…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" strokeWidth={1.5} />
            <div className="space-y-1">
              <h1 className="text-base font-semibold text-foreground">Email verificado</h1>
              <p className="text-sm text-muted-foreground">
                Tu dirección de email fue confirmada correctamente.
              </p>
            </div>
            <Button className="w-full" onClick={() => navigate('/dashboard')}>
              Ir al panel
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-destructive" strokeWidth={1.5} />
            <div className="space-y-1">
              <h1 className="text-base font-semibold text-foreground">No se pudo verificar</h1>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => navigate('/dashboard')}>
              Volver al panel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
