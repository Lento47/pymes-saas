import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallContext } from "./CallProvider";

export function CallErrorFallback() {
  const { error, dismissIncoming } = useCallContext();

  if (!error) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-card border border-border p-8 shadow-panel max-w-sm">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <p className="text-sm text-center text-foreground">{error}</p>
        <Button variant="outline" onClick={dismissIncoming}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}
