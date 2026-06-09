import { CheckCircle, XCircle, Clock } from "lucide-react";

interface CallQualitySummaryProps {
  duration: number;
  status: "completed" | "missed" | "rejected" | "dropped";
  quality?: {
    packets_lost?: number;
    jitter_ms?: number;
    bitrate_kbps?: number;
  };
  onClose?: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CallQualitySummary({ duration, status, quality, onClose }: CallQualitySummaryProps) {
  const statusConfig = {
    completed: { icon: CheckCircle, label: "Llamada completada", color: "text-emerald-500" },
    missed: { icon: Clock, label: "Llamada perdida", color: "text-amber-500" },
    rejected: { icon: XCircle, label: "Llamada rechazada", color: "text-destructive" },
    dropped: { icon: XCircle, label: "Llamada cortada por red", color: "text-destructive" },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="flex flex-col items-center gap-4 rounded-2xl bg-card border border-border p-8 shadow-panel max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <Icon className={`h-12 w-12 ${config.color}`} />

        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground">{config.label}</h3>
          <p className="text-sm text-muted-foreground mt-1">{formatDuration(duration)}</p>
        </div>

        {quality && status === "completed" && (
          <div className="grid grid-cols-3 gap-4 text-center text-xs text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">{quality.packets_lost ?? 0}</p>
              <p>Paquetes perdidos</p>
            </div>
            <div>
              <p className="font-medium text-foreground">{quality.jitter_ms?.toFixed(1) ?? "0.0"}</p>
              <p>Jitter (ms)</p>
            </div>
            <div>
              <p className="font-medium text-foreground">{quality.bitrate_kbps ?? 0}</p>
              <p>Bitrate (kbps)</p>
            </div>
          </div>
        )}

        <button
          className="text-sm text-muted-foreground hover:text-foreground transition-colors mt-2"
          onClick={onClose}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
