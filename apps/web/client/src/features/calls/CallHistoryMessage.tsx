import { Phone, PhoneOff, PhoneIncoming, PhoneMissed } from "lucide-react";

interface CallHistoryMessageProps {
  bodyText: string;
}

interface CallMetadata {
  call_type: "audio" | "video";
  status: "completed" | "missed" | "rejected";
  duration_seconds: number;
  caller_name: string;
  callee_name: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CallHistoryMessage({ bodyText }: CallHistoryMessageProps) {
  let meta: CallMetadata;
  try {
    meta = JSON.parse(bodyText);
  } catch {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs text-muted-foreground">Llamada</span>
      </div>
    );
  }

  const icon =
    meta.status === "missed" ? (
      <PhoneMissed className="h-3.5 w-3.5 text-destructive" />
    ) : meta.status === "rejected" ? (
      <PhoneOff className="h-3.5 w-3.5 text-amber-500" />
    ) : (
      <Phone className="h-3.5 w-3.5 text-emerald-500" />
    );

  const label =
    meta.status === "missed"
      ? `Llamada perdida de ${meta.caller_name}`
      : meta.status === "rejected"
        ? `Llamada rechazada`
        : `Llamada de ${meta.call_type === "video" ? "video" : "voz"} · ${meta.caller_name} → ${meta.callee_name}`;

  const durationText =
    meta.status === "completed" && meta.duration_seconds > 0
      ? ` · ${formatDuration(meta.duration_seconds)}`
      : "";

  return (
    <div className="flex justify-center py-2">
      <div className="flex items-center gap-1.5 rounded-full bg-muted/50 px-3 py-1">
        {icon}
        <span className="text-xs text-muted-foreground">
          {label}
          {durationText}
        </span>
      </div>
    </div>
  );
}
