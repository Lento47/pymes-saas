/**
 * AgentRunCard — inline agent status separator.
 *
 * Collapsed (default): thin line with centered dynamic label
 *   —————————— Analizando contexto ——————————
 *
 * Expanded (click): shows intent, pending fields, steps
 *
 * Compact, minimal, one-line when collapsed.
 */
import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Brain,
  FileText,
  Wrench,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface AgentStep {
  type: string;
  label: string;
  at: string;
}

export interface AgentArtifact {
  type: string;
  id: string;
  title: string;
}

export interface AgentRun {
  id: string;
  status: "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  intent: "ORDER" | "APPOINTMENT" | "QUOTE" | "COMPLAINT" | string;
  started_at: string;
  collected: Record<string, string | null>;
  pending_fields: string[];
  steps: AgentStep[];
  artifact: AgentArtifact | null;
}

/* ── Intent labels (Spanish) ────────────────────────────────────────────── */
const INTENT_LABELS: Record<string, string> = {
  ORDER:       "pedido",
  APPOINTMENT: "cita",
  QUOTE:       "cotización",
  COMPLAINT:   "queja",
  SUPPORT:     "soporte",
  BILLING:     "facturación",
  GENERAL:     "consulta",
};

function getIntentLabel(intent?: string | null): string {
  if (!intent) return "";
  return INTENT_LABELS[intent.toUpperCase()] ?? intent.toLowerCase().replace(/_/g, " ");
}

/* ── Running hints (rotating while no intent) ───────────────────────────── */
const RUNNING_HINTS = [
  "Pensando",
  "Leyendo contexto",
  "Analizando",
  "Verificando datos",
];

/* ── Step icon ──────────────────────────────────────────────────────────── */
function getStepIcon(stepType?: string) {
  if (!stepType) return <Loader2 className="h-3 w-3 animate-spin" />;
  if (stepType.includes("SEARCH") || stepType.includes("LOAD") || stepType.includes("CONTEXT")) {
    return <Brain className="h-3 w-3 animate-pulse" />;
  }
  if (stepType.includes("DRAFT") || stepType.includes("PREPARE") || stepType.includes("ARTIFACT")) {
    return <FileText className="h-3 w-3 animate-pulse" />;
  }
  if (stepType.includes("FIELD") || stepType.includes("CHECK")) {
    return <Wrench className="h-3 w-3 animate-pulse" />;
  }
  return <Loader2 className="h-3 w-3 animate-spin" />;
}

/* ── Build label ────────────────────────────────────────────────────────── */
function buildLabel(run: AgentRun): string {
  const steps = Array.isArray(run.steps) ? run.steps : [];
  const pending_fields = Array.isArray(run.pending_fields) ? run.pending_fields : [];
  const pending = pending_fields.length;
  const intentLabel = getIntentLabel(run.intent);

  if (run.status === "COMPLETED") return "Respuesta lista";
  if (run.status === "FAILED") return "Agente detenido";

  if (intentLabel) {
    const parts = [`Detectó ${intentLabel}`];
    if (pending > 0) parts.push(`${pending} dato${pending > 1 ? "s" : ""} pendiente${pending > 1 ? "s" : ""}`);
    return parts.join(" · ");
  }

  const startedAt = new Date(run.started_at).getTime();
  const bucket = Number.isFinite(startedAt)
    ? Math.floor((Date.now() - startedAt) / 2500) % RUNNING_HINTS.length
    : 0;
  return RUNNING_HINTS[bucket];
}

/* ── Component ──────────────────────────────────────────────────────────── */
interface Props {
  run: AgentRun;
  conversationId: string;
}

export function AgentRunCard({ run, conversationId }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const status = run?.status;
  const steps = Array.isArray(run?.steps) ? run.steps : [];
  const pending_fields = Array.isArray(run?.pending_fields) ? run.pending_fields : [];
  const lastStep = steps[steps.length - 1];

  useEffect(() => {
    if (status === "COMPLETED") {
      const t = setTimeout(() => setDismissed(true), 6000);
      return () => clearTimeout(t);
    }
  }, [status]);

  const stopMut = useMutation({
    mutationFn: () => api.stopAgentRun(conversationId),
    onSuccess: () => {
      qc.setQueryData(["agent-run", conversationId], null);
      toast({ title: "Agente detenido" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const label = useMemo(() => (run ? buildLabel(run) : ""), [run]);

  if (!run?.id || !status) return null;
  if (dismissed || status === "CANCELLED") return null;

  const isRunning = status === "RUNNING";
  const isCompleted = status === "COMPLETED";
  const isFailed = status === "FAILED";

  const toneColor = isCompleted
    ? "text-emerald-600 dark:text-emerald-400"
    : isFailed
      ? "text-destructive"
      : "text-violet-600 dark:text-violet-400";

  const lineColor = isCompleted
    ? "border-emerald-500/30"
    : isFailed
      ? "border-destructive/30"
      : "border-violet-500/20";

  return (
    <div className="px-3 py-2 sm:px-4">
      {/* Collapsed: separator line with centered label */}
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="flex w-full items-center gap-2 group"
        aria-expanded={expanded}
      >
        <div className={`flex-1 border-t ${lineColor}`} />
        <span className={cn("flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium", toneColor)}>
          {isRunning && (lastStep ? getStepIcon(lastStep.type) : <Loader2 className="h-3 w-3 animate-spin" />)}
          {isCompleted && <CheckCircle2 className="h-3 w-3" />}
          {isFailed && <AlertCircle className="h-3 w-3" />}
          {label}
          <ChevronDown className={cn("h-3 w-3 opacity-40 transition-transform", expanded && "rotate-180")} />
        </span>
        <div className={`flex-1 border-t ${lineColor}`} />
      </button>

      {/* Expanded: details */}
      {expanded && (
        <div className="mt-1.5 ml-4 space-y-1">
          {/* Intent */}
          {run.intent && (
            <p className="text-[10px] text-muted-foreground">
              Intención: <span className="font-medium text-foreground">{getIntentLabel(run.intent)}</span>
            </p>
          )}

          {/* Pending fields */}
          {isRunning && pending_fields.length > 0 && (
            <p className="text-[10px] text-muted-foreground">
              Pendiente: <span className="text-amber-600 dark:text-amber-400">{pending_fields.join(", ")}</span>
            </p>
          )}

          {/* Recent steps */}
          {steps.slice(-3).map((step, i) => (
            <p key={i} className="text-[10px] text-muted-foreground/70">
              {step.label || step.type.replace(/_/g, " ").toLowerCase()}
            </p>
          ))}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {isRunning && (
              <button
                onClick={(e) => { e.stopPropagation(); stopMut.mutate(); }}
                disabled={stopMut.isPending}
                className="text-[10px] text-destructive hover:underline"
              >
                Detener agente
              </button>
            )}
            {!isRunning && (
              <button
                onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
                className="text-[10px] text-muted-foreground hover:underline"
              >
                Cerrar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
