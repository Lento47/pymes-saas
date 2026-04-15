import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

function PymesMark() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="PYMES Logo">
      <rect width="40" height="40" rx="10" fill="#4f8ef7" fillOpacity="0.12" />
      <path
        d="M14 28V12h7.5c1.6 0 2.9.5 3.8 1.4.9.9 1.4 2.1 1.4 3.6s-.5 2.7-1.4 3.6c-.9.9-2.2 1.4-3.8 1.4H18v6h-4z"
        fill="#4f8ef7"
      />
      <path d="M18 15.2h3.2c.6 0 1 .2 1.3.5.3.3.5.7.5 1.3s-.2 1-.5 1.3c-.3.3-.7.5-1.3.5H18v-3.6z" fill="#0d0f14" />
    </svg>
  );
}

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
    if (isAuthenticated) {
      window.location.hash = "#/";
    }
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-[380px]">
        <div className="flex flex-col items-center mb-8">
          <PymesMark />
          <h1 className="text-lg font-semibold text-foreground mt-4">PYMES</h1>
          <p className="text-xs text-muted-foreground mt-1">Sign in to your workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="workspace" className="text-xs text-muted-foreground">Workspace</Label>
              <Input
                id="workspace"
                data-testid="input-workspace-slug"
                placeholder="my-company"
                value={workspaceSlug}
                onChange={(e) => setWorkspaceSlug(e.target.value)}
                required
                className="bg-background border-border h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                data-testid="input-email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background border-border h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs text-muted-foreground">Password</Label>
              <Input
                id="password"
                type="password"
                data-testid="input-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background border-border h-9 text-sm"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-9 text-sm font-medium"
            disabled={isLoading}
            data-testid="button-login"
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
