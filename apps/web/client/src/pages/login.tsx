import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

function parseLoginError(err: unknown): string {
  if (err instanceof Error) {
    const m = err.message;
    const idx = m.indexOf(": ");
    if (idx >= 0) {
      const rest = m.slice(idx + 2);
      try {
        const parsed = JSON.parse(rest) as { message?: string | string[] };
        if (Array.isArray(parsed.message)) return parsed.message.join(", ");
        if (typeof parsed.message === "string") return parsed.message;
      } catch {
        return rest || m;
      }
    }
    return m;
  }
  return "Error desconocido";
}

export default function LoginPage() {
  const { login, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (isAuthenticated) window.location.hash = "#/";
  }, [isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password, workspaceSlug);
      window.location.hash = "#/";
    } catch (err: unknown) {
      toast({
        title: "No se pudo iniciar sesión",
        description: parseLoginError(err),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex bg-[hsl(var(--background))]">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[44%] flex-col justify-between p-12 bg-[hsl(var(--card))] border-r border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[8px] bg-primary flex items-center justify-center">
            <span className="text-[12px] font-bold text-primary-foreground">P</span>
          </div>
          <span className="text-[14px] font-semibold text-foreground">Pymeshub</span>
        </div>

        <div>
          <blockquote className="text-[22px] font-light text-foreground leading-snug tracking-tight max-w-xs">
            "La operación de tu negocio,<br />en un solo lugar."
          </blockquote>
          <p className="text-[13px] text-muted-foreground mt-4">
            Conversaciones, contactos, tareas y documentos<br />para pymes en Costa Rica.
          </p>
        </div>

        <p className="text-[11px] text-muted-foreground/50">© 2026 Pymeshub</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-[360px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-[8px] bg-primary flex items-center justify-center">
              <span className="text-[12px] font-bold text-primary-foreground">P</span>
            </div>
            <span className="text-[14px] font-semibold text-foreground">Pymeshub</span>
          </div>

          <div className="mb-8">
            <h1 className="text-[20px] font-semibold text-foreground tracking-tight">Iniciar sesión</h1>
            <p className="text-[13px] text-muted-foreground mt-1">Ingresa a tu workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-muted-foreground">Workspace</Label>
              <Input
                data-testid="input-workspace-slug"
                placeholder="mi-empresa"
                value={workspaceSlug}
                onChange={(e) => setWorkspaceSlug(e.target.value)}
                required
                className="bg-[hsl(var(--card))] border-border h-9 text-[13px] placeholder:text-muted-foreground/40"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-muted-foreground">Correo</Label>
              <Input
                id="email"
                type="email"
                data-testid="input-email"
                placeholder="nombre@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-[hsl(var(--card))] border-border h-9 text-[13px] placeholder:text-muted-foreground/40"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-muted-foreground">Contraseña</Label>
              <Input
                id="password"
                type="password"
                data-testid="input-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-[hsl(var(--card))] border-border h-9 text-[13px]"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-9 text-[13px] font-medium mt-2"
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
              Entrar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
