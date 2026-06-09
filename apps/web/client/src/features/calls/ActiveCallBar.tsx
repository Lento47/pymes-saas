import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallContext } from "./CallProvider";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ActiveCallBar() {
  const { state, call, duration, endCall } = useCallContext();

  if (state !== "active" && state !== "connecting") return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-xl bg-card border border-border px-4 py-2.5 shadow-panel">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-sm font-medium text-foreground">
          {state === "connecting" ? "Conectando..." : formatDuration(duration)}
        </span>
      </div>

      <span className="text-xs text-muted-foreground">
        {call?.type === "video" ? "Videollamada" : "Llamada"}
      </span>

      <Button
        variant="destructive"
        size="sm"
        className="h-8 w-8 rounded-full p-0"
        onClick={endCall}
        aria-label="Terminar llamada"
      >
        <PhoneOff className="h-4 w-4" />
      </Button>
    </div>
  );
}
