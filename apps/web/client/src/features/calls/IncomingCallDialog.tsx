import { useEffect, useRef } from "react";
import { Phone, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createRingtone } from "./lib/ringtone";
import { useCallContext } from "./CallProvider";

export function IncomingCallDialog() {
  const { incomingCall, acceptCall, rejectCall } = useCallContext();
  const ringtoneRef = useRef<ReturnType<typeof createRingtone> | null>(null);

  useEffect(() => {
    if (incomingCall) {
      ringtoneRef.current = createRingtone();
      ringtoneRef.current.start();
    }
    return () => {
      ringtoneRef.current?.stop();
      ringtoneRef.current = null;
    };
  }, [incomingCall]);

  useEffect(() => {
    if (!incomingCall) return;
    const timer = setTimeout(() => {
      rejectCall();
    }, 30_000);
    return () => clearTimeout(timer);
  }, [incomingCall, rejectCall]);

  useEffect(() => {
    if (!incomingCall) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") acceptCall();
      if (e.key === "Escape") rejectCall();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [incomingCall, acceptCall, rejectCall]);

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 rounded-2xl bg-card border border-border p-8 shadow-panel">
        <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center ring-2 ring-accent/30 animate-pulse">
          <Phone className="h-8 w-8 text-accent" />
        </div>

        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">Llamada entrante</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {incomingCall.type === "video" ? "Videollamada" : "Llamada de voz"}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="lg"
            className="h-14 w-14 rounded-full p-0 bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20"
            onClick={rejectCall}
            aria-label="Rechazar"
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
          <Button
            size="lg"
            className="h-14 w-14 rounded-full p-0 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={acceptCall}
            aria-label="Aceptar"
          >
            <Phone className="h-6 w-6" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Enter para aceptar · Esc para rechazar
        </p>
      </div>
    </div>
  );
}
