/**
 * AgentRunCard — compact inline AI indicator.
 *
 * Shows a narrative one-liner inside the chat flow:
 *   RUNNING:  "Detectó solicitud de factura · 2 datos pendientes"
 *   COMPLETED: "Respuesta lista ✓"
 *   FAILED:    "Agente detenido — error"
 *
 * Matches the landing page AgentConsole style: intent + pending count,
 * not raw technical step names. Compact pill, contextual icons.
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

/* ── Intent labels (Spanish, narrative) ─────────────────────────────────── */
const INTENT_LABELS: Record<string, string> = {
  ORDER:       "un pedido",
  APPOINTMENT: "una cita",
  QUOTE:       "una cotización",
  COMPLAINT:   "una queja",
  SUPPORT:     "una consulta de soporte",
  BILLING:     "una consulta de facturación",
  GENERAL:     "una consulta general",
};

function getIntentLabel(intent?: string | null): string {
  if (!intent) return "";
  return INTENT_LABELS[intent.toUpperCase()] ?? intent.toLowerCase().replace(/_/g, " ");
}

/* ── Step icon (internal, not shown as label) ───────────────────────────── */
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

/* ── Running animation states ───────────────────────────────────────────── */
const RUNNING_HINTS = [
  "Analizando conversación",
  "Leyendo contexto",
  "Identificando intención",
  "Verificando datos",
];

/* ── Narrative status builder ───────────────────────────────────────────── */
function buildNarrative(run: AgentRun): { icon: React.ReactNode; text: string; tone: "running" | "success" | "error" } {
  const { status, intent } = run;
  const steps = Array.isArray(run.steps) ? run.steps : [];
  const pending_fields = Array.isArray(run.pending_fields) ? run.pending_fields : [];
  const lastStep = steps[steps.length - 1];
  const pending = pending_fields.length;

  if (status === "COMPLETED") {
    return {
      icon: <CheckCircle2 className="h-3 w-3" />,
      text: "Respuesta lista",
      tone: "success",
    };
  }

  if (status === "FAILED") {
    return {
      icon: <AlertCircle className="h-3 w-3" />,
      text: "Agente detenido",
      tone: "error",
    };
  }

  if (status === "CANCELLED") {
    return {
      icon: <X className="h-3 w-3" />,
      text: "Cancelado",
      tone: "error",
    };
  }

  // RUNNING — build narrative
  const intentLabel = getIntentLabel(intent);

  // If we have intent, show the narrative pattern
  if (intentLabel) {
    const parts: string[] = [];
    parts.push(`Detectó ${intentLabel}`);
    if (pending > 0) {
      parts.push(`${pending} dato${pending > 1 ? "s" : ""} pendiente${pending > 1 ? "s" : ""}`);
    }
    return {
      icon: getStepIcon(lastStep?.type),
      text: parts.join(" · "),
      tone: "running",
    };
  }

  // No intent yet — show hint
  const startedAt = new Date(run.started_at).getTime();
  const bucket = Number.isFinite(startedAt)
    ? Math.floor((Date.now() - startedAt) / 2500) % RUNNING_HINTS.length
    : 0;

  return {
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    text: RUNNING_HINTS[bucket],
    tone: "running",
  };
}

/* ── Component ──────────────────────────────────────────────────────────── */
interface Props {
  run: AgentRun;
  conversationId: string;
}

export function AgentRunCard({ run, conversationId }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const status = run?.status;
  const pending = Array.isArray(run?.pending_fields) ? run.pending_fields.length : 0;

  // Auto-dismiss completed after 8s
  useEffect(() => {
    if (status === "COMPLETED") {
      const t = setTimeout(() => setDismissed(true), 8000);
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

  const narrative = useMemo(() => (run ? buildNarrative(run) : null), [run]);

  if (!run?.id || !status || !narrative) return null;
  if (dismissed || status === "CANCELLED") return null;

  const isRunning = status === "RUNNING";

  const toneCls = {
    running: "bg-violet-500/[0.06] border-violet-500/15 text-violet-700 dark:text-violet-400",
    success: "bg-emerald-500/[0.08] border-emerald-500/20 text-emerald-700 dark:text-emerald-400",
    error:   "bg-destructive/[0.06] border-destructive/20 text-destructive",
  }[narrative.tone];

  const iconCls = {
    running: "text-violet-500",
    success: "text-emerald-500",
    error:   "text-destructive",
  }[narrative.tone];

  return (
    <div className="ml-8 flex items-center gap-1.5 px-2 py-1.5 sm:ml-10 sm:px-3">
      <div className={cn(
        "flex items-center gap-2 rounded-2xl rounded-bl-md border px-3 py-1.5 text-xs transition-all",
        toneCls,
      )}>
        <span className={iconCls}>{narrative.icon}</span>

        <span className="max-w-[260px] truncate leading-snug">
          {narrative.text}
        </span>

        {/* Pending count badge (only when running and has pending fields) */}
        {isRunning && pending > 0 && (
          <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
            {pending}
          </span>
        )}

        {/* Stop button (running) */}
        {isRunning && (
          <button
            onClick={() => stopMut.mutate()}
            disabled={stopMut.isPending}
            className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Detener agente"
            aria-label="Detener agente"
          >
            {stopMut.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
          </button>
        )}

        {/* Dismiss button (done/failed) */}
        {!isRunning && (
          <button
            onClick={() => setDismissed(true)}
            className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-muted"
            title="Cerrar"
            aria-label="Cerrar"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
