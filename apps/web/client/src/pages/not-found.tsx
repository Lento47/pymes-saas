import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Clock, LogIn } from "lucide-react";

export default function NotFound() {
  const path = window.location.pathname;
  const segments = path.split("/").filter(Boolean);
  const lastSlug = (() => { try { return localStorage.getItem("pymes_last_slug"); } catch { return null; } })();
  const looksLikeTimedOut = (segments.length >= 2 && !["login", "register", "accept-invite", "legal", "pricing", "documentation", "product"].includes(segments[0])) || !!lastSlug;

  if (looksLikeTimedOut) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-border/60 bg-card/40 backdrop-blur-sm">
          <CardContent className="pt-8 pb-6 text-center">
            <Clock className="mx-auto mb-3 h-10 w-10 text-amber-400" />
            <h1 className="text-xl font-semibold text-foreground">
              Sesión expirada
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Tu sesión se cerró por inactividad o venció. Ingresa de nuevo para continuar.
            </p>
            <a
              href="/login?expired=true"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(90deg,#efff53_0%,#ddff47_55%,#78efd0_100%)] px-6 py-3 text-sm font-semibold text-[#071126] transition hover:translate-y-[-1px]"
            >
              <LogIn className="h-4 w-4" />
              Ir al login
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border/60 bg-card/40">
        <CardContent className="pt-8 pb-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-foreground">404 Page Not Found</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            La página que buscas no existe o fue movida.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
