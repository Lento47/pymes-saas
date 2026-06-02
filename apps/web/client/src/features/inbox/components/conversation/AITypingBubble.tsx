/**
 * AITypingBubble — WhatsApp-style "PymesHub IA está escribiendo" indicator.
 *
 * Renders as an outbound bubble (violet, right-aligned) with bouncing dots.
 * Click to expand shows agent run details (intent, pending fields, stop button).
 */
import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, ChevronDown, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

/* ── Types ─────────────────────────────────────────────────────────── */
export interface AgentStep {
  type: string;
  label: string;
  at: string;
}

export interface AgentRun {
  id: string;
  status: "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  intent: "ORDER" | "APPOINTMENT" | "QUOTE" | "COMPLAINT" | string;
  started_at: string;
  collected: Record<string, string | null>;
  pending_fields: string[];
  steps: AgentStep[];
  artifact: { type: string; id: string; title: string } | null;
}

/* ── Intent labels ─────────────────────────────────────────────────── */
const INTENT_LABELS: Record<string, string> = {
  ORDER: "pedido",
  APPOINTMENT: "cita",
  QUOTE: "cotización",
  COMPLAINT: "queja",
  SUPPORT: "soporte",
  BILLING: "facturación",
};

function getIntentLabel(intent?: string | null): string {
  if (!intent) return "";
  return INTENT_LABELS[intent.toUpperCase()] ?? intent.toLowerCase().replace(/_/g, " ");
}

/* ── Component ─────────────────────────────────────────────────────── */
interface Props {
  /** When set, shows agent run details (intent, pending, stop button) */
  agentRun?: AgentRun | null;
  conversationId?: string;
  /** Static label shown above the dots */
  label?: string;
}

export function AITypingBubble({ agentRun, conversationId, label = "PymesHub IA" }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const isRunning = agentRun?.status === "RUNNING";
  const isCompleted = agentRun?.status === "COMPLETED";
  const isFailed = agentRun?.status === "FAILED";

  // Auto-dismiss completed runs after 4s
  useEffect(() => {
    if (isCompleted) {
      const t = setTimeout(() => setDismissed(true), 4000);
      return () => clearTimeout(t);
    }
  }, [isCompleted]);

  const stopMut = useMutation({
    mutationFn: () => api.stopAgentRun(conversationId!),
    onSuccess: () => {
      qc.setQueryData(["agent-run", conversationId], null);
      toast({ title: "Agente detenido" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Build subtitle text
  const subtitle = useMemo(() => {
    if (!agentRun) return null;
    const pending = Array.isArray(agentRun.pending_fields) ? agentRun.pending_fields : [];
    const intentLabel = getIntentLabel(agentRun.intent);
    if (isCompleted) return "respuesta lista";
    if (isFailed) return "agente detenido";
    if (intentLabel && pending.length > 0)
      return `detectó ${intentLabel} · ${pending.length} dato${pending.length > 1 ? "s" : ""} pendiente${pending.length > 1 ? "s" : ""}`;
    if (intentLabel) return `detectó ${intentLabel}`;
    return null;
  }, [agentRun, isCompleted, isFailed]);

  if (dismissed) return null;

  // Simple typing indicator (no agent run)
  if (!agentRun || agentRun.status === "CANCELLED") {
    return (
      <div className="flex gap-2 px-0.5 sm:gap-2.5 sm:px-1 justify-end" role="status" aria-live="polite" aria-label={`${label} está escribiendo`}>
        <div className="max-w-[72%] rounded-2xl rounded-br-md bg-violet-600 dark:bg-violet-700 px-3.5 py-2 shadow-sm">
          <div className="mb-1 text-[11px] font-medium leading-none text-violet-200">
            {label}
          </div>
          <div className="flex h-5 items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-200 [animation-delay:-0.24s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-200 [animation-delay:-0.12s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-200" />
          </div>
        </div>
      </div>
    );
  }

  // Agent run bubble (with details on expand)
  const statusColor = isCompleted
    ? "bg-emerald-600 dark:bg-emerald-700"
    : isFailed
      ? "bg-red-600 dark:bg-red-700"
      : "bg-violet-600 dark:bg-violet-700";

  const labelColor = isCompleted
    ? "text-emerald-200"
    : isFailed
      ? "text-red-200"
      : "text-violet-200";

  const dotColor = isCompleted
    ? "bg-emerald-200"
    : isFailed
      ? "bg-red-200"
      : "bg-violet-200";

  return (
    <div className="flex gap-2 px-0.5 sm:gap-2.5 sm:px-1 justify-end" role="status" aria-live="polite">
      <div className="max-w-[84%] sm:max-w-[68%]">
        {/* Main bubble */}
        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          className={cn("w-full text-left rounded-2xl rounded-br-md px-3.5 py-2 shadow-sm", statusColor)}
        >
          <div className={cn("mb-1 flex items-center gap-1.5 text-[11px] font-medium leading-none", labelColor)}>
            {isCompleted && <CheckCircle2 className="h-3 w-3" />}
            {isFailed && <AlertCircle className="h-3 w-3" />}
            <span>{label}</span>
            {subtitle && <span className="opacity-60">· {subtitle}</span>}
            <ChevronDown className={cn("h-3 w-3 ml-auto opacity-40 transition-transform", expanded && "rotate-180")} />
          </div>

          {/* Dots or status icon */}
          {isRunning ? (
            <div className="flex h-5 items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 animate-bounce rounded-full", dotColor, "[animation-delay:-0.24s]")} />
              <span className={cn("h-1.5 w-1.5 animate-bounce rounded-full", dotColor, "[animation-delay:-0.12s]")} />
              <span className={cn("h-1.5 w-1.5 animate-bounce rounded-full", dotColor)} />
            </div>
          ) : (
            <div className="flex h-5 items-center">
              <span className={cn("text-[12px]", labelColor)}>
                {isCompleted ? "✓ lista" : "✕ detenida"}
              </span>
            </div>
          )}
        </button>

        {/* Expanded details */}
        {expanded && agentRun && (
          <div className="mt-1.5 space-y-1 px-1">
            {agentRun.intent && (
              <p className="text-[11px] text-muted-foreground">
                Intención: <span className="font-medium text-foreground">{getIntentLabel(agentRun.intent)}</span>
              </p>
            )}
            {isRunning && Array.isArray(agentRun.pending_fields) && agentRun.pending_fields.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Pendiente: <span className="text-amber-600 dark:text-amber-400">{agentRun.pending_fields.join(", ")}</span>
              </p>
            )}
            {Array.isArray(agentRun.steps) && agentRun.steps.slice(-3).map((step, i) => (
              <p key={i} className="text-[10px] text-muted-foreground/60">
                {step.label || step.type.replace(/_/g, " ").toLowerCase()}
              </p>
            ))}
            {isRunning && conversationId && (
              <button
                onClick={(e) => { e.stopPropagation(); stopMut.mutate(); }}
                disabled={stopMut.isPending}
                className="text-[11px] text-destructive hover:underline"
              >
                Detener agente
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
