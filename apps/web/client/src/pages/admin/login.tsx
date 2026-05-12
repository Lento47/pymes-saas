import { useEffect, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";

export default function AdminLogin() {
  const [loading, setLoading] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  const errorMsg =
    error === "not_admin" ? "Este correo no tiene acceso de administrador."
    : error ? "Error de autenticación. Intentá de nuevo."
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar">
      <div className="w-full max-w-sm mx-auto p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 mb-4">
            <ShieldCheck className="w-6 h-6 text-amber-400" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Admin PymesHub</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Acceso exclusivo para administradores de plataforma
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
            {errorMsg}
          </div>
        )}

        <a
          href="/api/auth/admin/login"
          onClick={() => setLoading(true)}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ShieldCheck className="w-4 h-4" />
          )}
          Iniciar sesión como Admin
        </a>

        <p className="text-center mt-6 text-xs text-muted-foreground">
          Usamos Auth0 para autenticación segura.
        </p>
      </div>
    </div>
  );
}
