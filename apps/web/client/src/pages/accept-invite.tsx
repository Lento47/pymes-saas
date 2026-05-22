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
  const search = new URLSearchParams(window.location.search).get("token");
  if (search) return search;
  const hash = window.location.hash;
  const qi = hash.indexOf("?");
  return qi >= 0 ? (new URLSearchParams(hash.slice(qi + 1)).get("token") ?? "") : "";
}

function parseCodeFromUrl() {
  return new URLSearchParams(window.location.search).get("code") ?? "";
}

function parseError(err: unknown): string {
  if (!(err instanceof Error)) return "No se pudo procesar la invitación.";
  const m = err.message;
  const after = m.indexOf(": ");
  return after >= 0 ? m.slice(after + 2) : m;
}

export default function AcceptInvitePage() {
  const { acceptInvite, isAuthenticated, login, user } = useAuth();
  const { toast } = useToast();
  const token = useMemo(() => parseTokenFromUrl(), []);
  const code = useMemo(() => parseCodeFromUrl(), []);
  const isCodeFlow = !!code;
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [codeInput, setCodeInput] = useState(code);

  useEffect(() => {
    if (isCodeFlow) {
      if (!code) { setLoading(false); return; }
      void (async () => {
        try {
          const result = await api.previewInviteCode(code);
          setPreview({ ...result, email: user?.email || "", requires_account_setup: false } as InvitePreview);
        } catch (err) { setError(parseError(err)); }
        finally { setLoading(false); }
      })();
      return;
    }

    if (!token) {
      // no token y no code — muestra el formulario de entrada manual
      setLoading(false);
      return;
    }

    let active = true;
    void api.getInvitePreview(token)
      .then((result) => {
        if (!active) return;
        setPreview(result as InvitePreview);
        setName(result.name ?? "");
      })
      .catch((err) => {
        if (!active) return;
        setError(parseError(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [token, code, isCodeFlow, user?.email]);

  useEffect(() => {
    if (isAuthenticated && !isCodeFlow) {
      history.replaceState(null, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, [isAuthenticated, isCodeFlow]);

  const handleAccept = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (isCodeFlow || codeInput) {
        await api.redeemInviteCode({ code: codeInput, name, password });
        toast({ title: "Invitación aceptada", description: "Ya eres miembro del workspace." });
        history.replaceState(null, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
        return;
      }

      if (!token) return;
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
          <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">PymesHub</p>
          <h1 className="mt-2 text-2xl font-semibold">{isCodeFlow ? "Ingresar con código" : "Aceptar invitación"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isCodeFlow ? "Ingresá el código de invitación que te compartieron." : "Completa tu acceso al workspace desde este enlace seguro."}
          </p>
        </div>

        {!loading && !isCodeFlow && !token && !preview && (
          <form onSubmit={handleAccept} className="space-y-4">
            <div>
              <Label>Código de invitación</Label>
              <Input value={codeInput} onChange={e => setCodeInput(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={6} className="mt-1 text-center tracking-[0.5em] uppercase" />
            </div>
            <Button type="submit" disabled={!codeInput || submitting} className="w-full">
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verificando...</> : "Verificar código"}
            </Button>
          </form>
        )}

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
