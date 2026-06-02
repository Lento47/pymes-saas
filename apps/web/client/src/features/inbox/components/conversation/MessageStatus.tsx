import { Check, CheckCheck, Clock, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MessageStatusProps {
  direction: string;
  deliveryStatus?: string | null;
  deliveryError?: string | null;
  /** "light" = white icons (dark bubble). "dark" = muted icons (light bubble). */
  variant?: "light" | "dark";
}

export function MessageStatus({ direction, deliveryStatus, deliveryError, variant = "light" }: MessageStatusProps) {
  if (direction !== "OUTBOUND") return null;

  const dimCls  = variant === "light" ? "text-white/70"  : "text-[#111827]/40";
  const fadeCls = variant === "light" ? "text-white/50"  : "text-[#111827]/30";
  const blueCls = variant === "light" ? "text-sky-300"   : "text-[#2481cc]";

  const s = (deliveryStatus ?? "").toLowerCase();

  if (deliveryError || s === "failed" || s === "dispatch_failed") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertCircle className="w-3 h-3 text-red-400 shrink-0 cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px]">
            <p className="text-xs">{deliveryError || "Error de envío"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (s === "pending") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Clock className={`w-3 h-3 shrink-0 ${fadeCls}`} />
          </TooltipTrigger>
          <TooltipContent side="top"><p className="text-xs">Pendiente</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (!deliveryStatus || s === "sent") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Check className={`w-3 h-3 shrink-0 ${dimCls}`} />
          </TooltipTrigger>
          <TooltipContent side="top"><p className="text-xs">Enviado ✓</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (s === "delivered") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <CheckCheck className={`w-3 h-3 shrink-0 ${dimCls}`} />
          </TooltipTrigger>
          <TooltipContent side="top"><p className="text-xs">Entregado ✓✓</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (s === "read" || s === "played") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <CheckCheck className={`w-3 h-3 shrink-0 ${blueCls}`} />
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">{s === "played" ? "Reproducido" : "Leído ✓✓"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <Check className={`w-3 h-3 shrink-0 ${dimCls}`} />;
}
