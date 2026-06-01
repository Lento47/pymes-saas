import { Check, CheckCheck, Loader2, Clock, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MessageStatusProps {
  direction: string;
  deliveryStatus?: string | null;
  deliveryError?: string | null;
}

/**
 * WhatsApp-style status ticks:
 * - PENDING / null: clock icon (waiting to send)
 * - SENT: single grey check ✓
 * - DELIVERED: double grey checks ✓✓
 * - READ: double blue checks ✓✓
 * - FAILED / DISPATCH_FAILED: ⚠ alert
 */
export function MessageStatus({ direction, deliveryStatus, deliveryError }: MessageStatusProps) {
  if (direction !== "OUTBOUND") return null;

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

  // No explicit status — if outbound, treat as "sent" (at minimum the UI sent it)
  if (!deliveryStatus && direction === "OUTBOUND") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Check className="w-3 h-3 text-white/70 shrink-0" />
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">Enviado</p>
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
            <Clock className="w-3 h-3 text-white/50 shrink-0" />
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">Pendiente</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (s === "sent") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Check className="w-3 h-3 text-white/70 shrink-0" />
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">Enviado ✓</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (s === "delivered") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <CheckCheck className="w-3 h-3 text-white/70 shrink-0" />
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">Entregado ✓✓</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (s === "read") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <CheckCheck className="w-3 h-3 text-sky-300 shrink-0" />
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">Leído ✓✓</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (s === "played") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <CheckCheck className="w-3 h-3 text-sky-300 shrink-0" />
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">Reproducido</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Unknown status — single check
  return <Check className="w-3 h-3 text-white/70 shrink-0" />;
}
