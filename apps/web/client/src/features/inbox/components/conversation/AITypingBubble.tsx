/**
 * AITypingBubble — Inline AI "thinking" trace for PymesHub IA runs.
 *
 * Starts expanded when RUNNING; auto-collapses to a summary when COMPLETED/FAILED.
 * Stays in the timeline permanently — no auto-dismiss.
 */
import { useState, useEffect, useMemo } from "react";
import type { ElementType } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  Brain,
  MessageCircle,
  Check,
  Package,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
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

/* ── Step icon mapping ──────────────────────────────────────────────── */
const STEP_ICONS: Record<string, ElementType> = {
  INTENT_DETECTED: Brain,
  QUESTION_SENT: MessageCircle,
  FIELD_COLLECTED: Check,
  ARTIFACT_CREATED: Package,
};

/* ── Component ─────────────────────────────────────────────────────── */
interface Props {
  /** When set, shows agent run details (intent, steps, stop button) */
  agentRun?: AgentRun | null;
  conversationId?: string;
  /** Label shown in the bubble header */
  label?: string;
}

export function AITypingBubble({ agentRun, conversationId, label = "PymesHub IA" }: Props) {
  const isRunning = agentRun?.status === "RUNNING";
  const isCompleted = agentRun?.status === "COMPLETED";
  const isFailed = agentRun?.status === "FAILED";

  // Start expanded when running; collapsed otherwise
  const [expanded, setExpanded] = useState(isRunning);

  const { toast } = useToast();
  const qc = useQueryClient();

  // Auto-collapse when the run finishes
  useEffect(() => {
    if (isCompleted || isFailed) setExpanded(false);
  }, [isCompleted, isFailed]);

  // "pensó en Xs" — computed once when completed
  const elapsedSeconds = useMemo(() => {
    if (!isCompleted || !agentRun?.started_at) return null;
    const secs = Math.round((Date.now() - new Date(agentRun.started_at).getTime()) / 1000);
    return secs > 0 ? secs : null;
  }, [isCompleted, agentRun?.started_at]);

  const stopMut = useMutation({
    mutationFn: () => api.stopAgentRun(conversationId!),
    onSuccess: () => {
      qc.setQueryData(["agent-run", conversationId], null);
      toast({ title: "Agente detenido" });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Simple typing dots fallback (no active agent run)
  if (!agentRun || agentRun.status === "CANCELLED") {
    return (
      <div
        className="flex gap-2 px-0.5 sm:gap-2.5 sm:px-1 justify-end"
        role="status"
        aria-live="polite"
        aria-label={`${label} está escribiendo`}
      >
        <div className="max-w-[72%] rounded-2xl rounded-br-md bg-violet-600 dark:bg-violet-700 px-3.5 py-2 shadow-sm">
          <div className="mb-1 text-[11px] font-medium leading-none text-violet-200">{label}</div>
          <div className="flex h-5 items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-200 [animation-delay:-0.24s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-200 [animation-delay:-0.12s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-200" />
          </div>
        </div>
      </div>
    );
  }

  const steps = Array.isArray(agentRun.steps) ? agentRun.steps : [];

  const headerBg = isCompleted
    ? "bg-emerald-700 dark:bg-emerald-800"
    : isFailed
      ? "bg-red-700 dark:bg-red-800"
      : "bg-violet-600 dark:bg-violet-700";

  const traceBg = isCompleted
    ? "bg-emerald-800/70 dark:bg-emerald-900/70"
    : isFailed
      ? "bg-red-800/70 dark:bg-red-900/70"
      : "bg-violet-700/70 dark:bg-violet-800/70";

  const headerTextCls = isCompleted
    ? "text-emerald-200"
    : isFailed
      ? "text-red-200"
      : "text-violet-200";

  const stepIconCls = isCompleted
    ? "text-emerald-300/70"
    : isFailed
      ? "text-red-300/70"
      : "text-violet-300/70";

  const stepTextCls = isCompleted
    ? "text-emerald-100/80"
    : isFailed
      ? "text-red-100/80"
      : "text-violet-100/80";

  return (
    <div className="flex gap-2 px-0.5 sm:gap-2.5 sm:px-1 justify-end" role="status" aria-live="polite">
      <div className="max-w-[84%] sm:max-w-[68%]">
        {/* ── Header toggle button ─────────────────────────────────── */}
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className={cn(
            "w-full text-left rounded-2xl rounded-br-md px-3.5 py-2 shadow-sm",
            headerBg,
          )}
        >
          <div className={cn("flex items-center gap-1.5 text-[11px] font-medium leading-none", headerTextCls)}>
            {isCompleted ? (
              <CheckCircle2 className="h-3 w-3 shrink-0" />
            ) : isFailed ? (
              <AlertCircle className="h-3 w-3 shrink-0" />
            ) : (
              <Bot className="h-3 w-3 shrink-0" />
            )}
            <span>{label}</span>
            {isCompleted && elapsedSeconds && (
              <span className="opacity-60">· pensó en {elapsedSeconds}s</span>
            )}
            {isFailed && <span className="opacity-60">· detenida</span>}
            {isRunning && steps.length > 0 && (
              <span className="opacity-60">· {steps.length} paso{steps.length !== 1 ? "s" : ""}</span>
            )}
            <ChevronDown
              className={cn(
                "h-3 w-3 ml-auto opacity-40 transition-transform duration-200",
                expanded && "rotate-180",
              )}
            />
          </div>

          {/* Bouncing dots shown in header while running + collapsed */}
          {isRunning && !expanded && (
            <div className="mt-1.5 flex h-4 items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-200 [animation-delay:-0.24s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-200 [animation-delay:-0.12s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-200" />
            </div>
          )}
        </button>

        {/* ── Collapsible step trace ───────────────────────────────── */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-200 mt-0.5 rounded-2xl rounded-br-md",
            traceBg,
            expanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <div className="space-y-2 px-3.5 py-2.5">
            {steps.map((step, i) => {
              const isLastAndRunning = i === steps.length - 1 && isRunning;
              const Icon = STEP_ICONS[step.type] ?? Check;
              return (
                <div key={i} className="flex items-start gap-2 text-[11px]">
                  {isLastAndRunning ? (
                    <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-violet-300 animate-pulse" />
                  ) : (
                    <Icon className={cn("mt-0.5 h-3 w-3 shrink-0", stepIconCls)} />
                  )}
                  <span className={cn("leading-relaxed", stepTextCls)}>
                    {step.label || step.type.replace(/_/g, " ").toLowerCase()}
                  </span>
                </div>
              );
            })}

            {steps.length === 0 && isRunning && (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />
                <span className="text-violet-100/60">Iniciando...</span>
              </div>
            )}

            {isRunning && conversationId && (
              <div className="pt-1.5 border-t border-violet-500/30">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    stopMut.mutate();
                  }}
                  disabled={stopMut.isPending}
                  className="text-[11px] text-red-300 hover:text-red-200 hover:underline disabled:opacity-50"
                >
                  Detener agente
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
