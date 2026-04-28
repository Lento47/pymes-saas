import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type InvitePreview = {
  email: string;
  name: string;
  requires_account_setup: boolean;
  role: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
};

function parseTokenFromUrl() {
  return new URLSearchParams(window.location.search).get("token") ?? "";
}

function parseError(err: unknown): string {
  if (!(err instanceof Error)) return "No se pudo procesar la invitación.";
  const m = err.message;
  const after = m.indexOf(": ");
  return after >= 0 ? m.slice(after + 2) : m;
}

export default function AcceptInvitePage() {
  const { acceptInvite, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const token = useMemo(() => parseTokenFromUrl(), []);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!token) {
      setError("El enlace no incluye un token de invitación válido.");
      setLoading(false);
      return;
    }

    let active = true;
    void api.getInvitePreview(token)
      .then((result) => {
        if (!active) return;
        setPreview(result);
        setName(result.name ?? "");
      })
      .catch((err) => {
        if (!active) return;
        setError(parseError(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (isAuthenticated) {
      history.replaceState(null, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, [isAuthenticated]);

  const handleAccept = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;

    setSubmitting(true);
    setError(null);

    try {
      await acceptInvite(
        token,
        preview?.requires_account_setup ? name : undefined,
        preview?.requires_account_setup ? password : undefined,
      );
      toast({ title: "Invitación aceptada", description: "Tu acceso ya está listo." });
      history.replaceState(null, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (err) {
      setError(parseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Pymeshub</p>
          <h1 className="mt-2 text-2xl font-semibold">Aceptar invitación</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Completa tu acceso al workspace desde este enlace seguro.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Validando invitación...
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
            <Link href="/login" className="text-sm text-primary underline">
              Volver al login
            </Link>
          </div>
        ) : preview ? (
          <form className="space-y-5" onSubmit={handleAccept}>
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
              <p><span className="font-medium">Workspace:</span> {preview.workspace.name}</p>
              <p><span className="font-medium">Correo:</span> {preview.email}</p>
              <p><span className="font-medium">Rol:</span> {preview.role}</p>
            </div>

            {preview.requires_account_setup ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="invite-name">Nombre</Label>
                  <Input
                    id="invite-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Tu nombre"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-password">Contraseña</Label>
                  <Input
                    id="invite-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    required
                  />
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                Esta invitación corresponde a una cuenta existente. Al continuar, se abrirá el workspace directamente.
              </div>
            )}

            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <Button className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                "Aceptar invitación"
              )}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
