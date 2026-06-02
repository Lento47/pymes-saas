import { Check, CheckCheck, Clock, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MessageStatusProps {
  direction: string;
  deliveryStatus?: string | null;
  deliveryError?: string | null;
  /** Tailwind color class for sent/delivered/pending icons (from channel theme). */
  dimCls?: string;
  /** Tailwind color class for the read/played double-tick (from channel theme). */
  readCls?: string;
}

export function MessageStatus({ direction, deliveryStatus, deliveryError, dimCls = "text-white/70", readCls = "text-sky-300" }: MessageStatusProps) {
  if (direction !== "OUTBOUND") return null;

  const blueCls = readCls;

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
            <Clock className={`w-3 h-3 shrink-0 ${dimCls} opacity-70`} />
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
