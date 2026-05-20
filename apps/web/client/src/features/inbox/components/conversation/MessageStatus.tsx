import { Check, CheckCheck, Loader2, Clock, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MessageStatusProps {
  direction: string;
  deliveryStatus?: string | null;
  deliveryError?: string | null;
}

export function MessageStatus({ direction, deliveryStatus, deliveryError }: MessageStatusProps) {
  if (direction !== "OUTBOUND") return null;

  if (deliveryError) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">Envío fallido</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (deliveryStatus === "dispatch_failed") {
    return <Clock className="w-3 h-3 text-amber-400 shrink-0" />;
  }

  if (deliveryStatus === "delivered" || deliveryStatus === "sent") {
    return <CheckCheck className="w-3 h-3 text-muted-foreground/50 shrink-0" />;
  }

  return <Check className="w-3 h-3 text-muted-foreground/50 shrink-0" />;
}
