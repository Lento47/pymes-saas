/**
 * AITypingBubble — Stream-of-thought trace for PymesHub IA agent runs.
 *
 * Full-width, timeline-style panel (not a chat bubble) that shows the AI's
 * reasoning steps inline in the operator's conversation view.
 * Starts expanded when RUNNING; auto-collapses to a summary on completion.
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
  CheckCircle2,
  AlertCircle,
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

/* ── Step metadata ──────────────────────────────────────────────────── */
const STEP_ICONS: Record<string, ElementType> = {
  INTENT_DETECTED: Brain,
  QUESTION_SENT: MessageCircle,
  FIELD_COLLECTED: Check,
  ARTIFACT_CREATED: Package,
};

const STEP_SECTION_LABELS: Record<string, string> = {
  INTENT_DETECTED: "Analizando",
  QUESTION_SENT: "Preguntando",
  FIELD_COLLECTED: "Recopiló",
  ARTIFACT_CREATED: "Finalizó",
};

/* ── Component ─────────────────────────────────────────────────────── */
interface Props {
  agentRun?: AgentRun | null;
  conversationId?: string;
  label?: string;
}

export function AITypingBubble({ agentRun, conversationId, label = "PymesHub IA" }: Props) {
  const isRunning = agentRun?.status === "RUNNING";
  const isCompleted = agentRun?.status === "COMPLETED";
  const isFailed = agentRun?.status === "FAILED";

  const [expanded, setExpanded] = useState(isRunning);
  const { toast } = useToast();
  const qc = useQueryClient();

  // Auto-expand on new run; auto-collapse when done
  useEffect(() => {
    if (isRunning) setExpanded(true);
  }, [isRunning]);

  useEffect(() => {
    if (isCompleted || isFailed) setExpanded(false);
  }, [isCompleted, isFailed]);

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

  // No active run — simple typing dots (same as before, won't show in MessageTimeline
  // since it filters CANCELLED runs out before rendering this component)
  if (!agentRun || agentRun.status === "CANCELLED") {
    return (
      <div
        className="flex items-center gap-2 px-1 py-1.5"
        role="status"
        aria-live="polite"
        aria-label={`${label} está escribiendo`}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted/60">
          <Bot className="h-3 w-3 text-muted-foreground/60" strokeWidth={1.75} />
        </span>
        <span className="text-[11px] text-muted-foreground/60">{label}</span>
        <span className="flex items-center gap-1">
          <span className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground/30 [animation-delay:0ms]" />
          <span className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground/30 [animation-delay:150ms]" />
          <span className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground/30 [animation-delay:300ms]" />
        </span>
      </div>
    );
  }

  const steps = Array.isArray(agentRun.steps) ? agentRun.steps : [];

  // Status dot color
  const dotCls = isCompleted
    ? "bg-emerald-500"
    : isFailed
      ? "bg-red-400"
      : "bg-primary animate-pulse";

  return (
    <div className="my-1 w-full" role="status" aria-live="polite">
      <div className={cn(
        "rounded-xl border border-border/50 bg-muted/20 transition-colors",
        isCompleted && "border-emerald-500/20 bg-emerald-500/[0.03]",
        isFailed && "border-red-400/20 bg-red-400/[0.03]",
      )}>
        {/* ── Header ──────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
        >
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotCls)} />
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-foreground/75">
            {isCompleted
              ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" strokeWidth={1.75} />
              : isFailed
              ? <AlertCircle className="h-3.5 w-3.5 text-red-400" strokeWidth={1.75} />
              : <Bot className="h-3.5 w-3.5 text-primary/60" strokeWidth={1.75} />
            }
            {label}
          </span>

          <span className="text-[11px] text-muted-foreground/50">
            {isRunning && steps.length > 0 && `· ${steps.length} paso${steps.length !== 1 ? "s" : ""}`}
            {isCompleted && elapsedSeconds && `· pensó en ${elapsedSeconds}s`}
            {isCompleted && !elapsedSeconds && "· completado"}
            {isFailed && "· detenida"}
          </span>

          <ChevronDown
            className={cn(
              "ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/30 transition-transform duration-200",
              expanded && "rotate-180",
            )}
            strokeWidth={1.75}
          />
        </button>

        {/* ── Timeline body ────────────────────────────────────────── */}
        <div className={cn(
          "overflow-hidden transition-all duration-200",
          expanded ? "max-h-[480px] opacity-100" : "max-h-0 opacity-0",
        )}>
          <div className="px-4 pb-3">
            {/* Vertical timeline */}
            <div className="relative ml-0.5 border-l border-border/40 pl-4 space-y-4">
              {steps.map((step, i) => {
                const isLast = i === steps.length - 1;
                const isLastRunning = isLast && isRunning;
                const Icon = STEP_ICONS[step.type] ?? Check;
                const sectionLabel = STEP_SECTION_LABELS[step.type];

                return (
                  <div key={i} className="relative">
                    {/* Timeline node */}
                    <span className={cn(
                      "absolute -left-[1.3125rem] top-[3px] h-2.5 w-2.5 rounded-full border-2 border-background ring-1",
                      isLastRunning
                        ? "bg-primary/30 ring-primary/40"
                        : "bg-background ring-border/60",
                    )} />

                    {/* Section label */}
                    {sectionLabel && (
                      <p className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                        <Icon className="h-3 w-3" strokeWidth={1.75} />
                        {sectionLabel}
                      </p>
                    )}

                    {/* Step content */}
                    {step.type === "QUESTION_SENT" ? (
                      <div className="mt-0.5 inline-block max-w-full rounded-lg border border-border/50 bg-background px-3 py-1.5 text-[12px] text-foreground/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                        {step.label}
                      </div>
                    ) : (
                      <p className="text-[12px] leading-relaxed text-foreground/70">
                        {step.label}
                      </p>
                    )}
                  </div>
                );
              })}

              {/* Running indicator — appears after the last step */}
              {isRunning && (
                <div className="relative">
                  <span className="absolute -left-[1.3125rem] top-[3px] h-2.5 w-2.5 rounded-full border-2 border-background bg-muted ring-1 ring-border/30" />
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
                    Esperando respuesta
                    <span className="flex gap-0.5">
                      <span className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground/30 [animation-delay:0ms]" />
                      <span className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground/30 [animation-delay:150ms]" />
                      <span className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground/30 [animation-delay:300ms]" />
                    </span>
                  </p>
                </div>
              )}

              {/* Completed / failed terminal node */}
              {(isCompleted || isFailed) && (
                <div className="relative">
                  <span className={cn(
                    "absolute -left-[1.3125rem] top-[3px] h-2.5 w-2.5 rounded-full border-2 border-background ring-1",
                    isCompleted ? "bg-emerald-500/70 ring-emerald-500/40" : "bg-red-400/70 ring-red-400/40",
                  )} />
                  <p className={cn(
                    "text-[11px] font-medium",
                    isCompleted ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400",
                  )}>
                    {isCompleted ? "Finalizado" : "Detenida"}
                  </p>
                </div>
              )}
            </div>

            {/* Stop button */}
            {isRunning && conversationId && (
              <div className="mt-3 ml-4">
                <button
                  onClick={() => stopMut.mutate()}
                  disabled={stopMut.isPending}
                  className="text-[11px] text-muted-foreground/50 hover:text-destructive hover:underline disabled:opacity-40 transition-colors"
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
