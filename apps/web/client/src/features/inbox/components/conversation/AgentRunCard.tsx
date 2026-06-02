/**
 * AgentRunCard — inline AI separator with pill + pulsing dot.
 *
 * Collapsed (default):
 *   ———————— PymesHub IA · revisando contexto ————————
 *
 * Expanded (click):
 *   ———————— PymesHub IA · Detectó pedido · 2 datos pendientes ▼ ————————
 *     Intención: pedido
 *     Pendiente: email, teléfono
 *     [Detener agente]
 *
 * Single visible separator, status changes dynamically.
 */
import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
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

/* ── Status rotation ────────────────────────────────────────────────────── */
const AI_STATUSES = [
  "analizando mensaje",
  "revisando contexto",
  "consultando información del negocio",
  "validando políticas",
  "preparando respuesta",
];

const INTENT_LABELS: Record<string, string> = {
  ORDER:       "pedido",
  APPOINTMENT: "cita",
  QUOTE:       "cotización",
  COMPLAINT:   "queja",
  SUPPORT:     "soporte",
  BILLING:     "facturación",
};

function getIntentLabel(intent?: string | null): string {
  if (!intent) return "";
  return INTENT_LABELS[intent.toUpperCase()] ?? intent.toLowerCase().replace(/_/g, " ");
}

function buildStatusText(run: AgentRun): string {
  const pending_fields = Array.isArray(run.pending_fields) ? run.pending_fields : [];
  const pending = pending_fields.length;
  const intentLabel = getIntentLabel(run.intent);

  if (run.status === "COMPLETED") return "respuesta lista";
  if (run.status === "FAILED") return "agente detenido";

  if (intentLabel) {
    const parts = [`detectó ${intentLabel}`];
    if (pending > 0) parts.push(`${pending} dato${pending > 1 ? "s" : ""} pendiente${pending > 1 ? "s" : ""}`);
    return parts.join(" · ");
  }

  const startedAt = new Date(run.started_at).getTime();
  const bucket = Number.isFinite(startedAt)
    ? Math.floor((Date.now() - startedAt) / 2500) % AI_STATUSES.length
    : 0;
  return AI_STATUSES[bucket];
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

  const statusText = useMemo(() => (run ? buildStatusText(run) : ""), [run]);

  if (!run?.id || !status) return null;
  if (dismissed || status === "CANCELLED") return null;

  const isRunning = status === "RUNNING";
  const isCompleted = status === "COMPLETED";
  const isFailed = status === "FAILED";

  const pillCls = isCompleted
    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950"
    : isFailed
      ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
      : "border-violet-100 bg-violet-50 dark:border-violet-800 dark:bg-violet-950";

  const textCls = isCompleted
    ? "text-emerald-700 dark:text-emerald-400"
    : isFailed
      ? "text-red-700 dark:text-red-400"
      : "text-violet-700 dark:text-violet-400";

  const dotCls = isCompleted
    ? "bg-emerald-500"
    : isFailed
      ? "bg-red-500"
      : "bg-violet-500";

  const pingCls = isCompleted
    ? "bg-emerald-400"
    : isFailed
      ? "bg-red-400"
      : "bg-violet-400";

  const lineCls = isCompleted
    ? "bg-emerald-200 dark:bg-emerald-800"
    : isFailed
      ? "bg-red-200 dark:bg-red-800"
      : "bg-slate-200 dark:bg-slate-700";

  return (
    <div className="px-3 py-1.5 sm:px-4">
      {/* Separator line + pill */}
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="flex w-full items-center gap-3 group"
        aria-expanded={expanded}
      >
        <div className={`h-px flex-1 ${lineCls}`} />

        <div className={cn("flex items-center gap-2 rounded-full border px-3 py-1", pillCls)}>
          {/* Pulsing dot — only when running */}
          {isRunning && (
            <span className="relative flex h-2 w-2">
              <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", pingCls)} />
              <span className={cn("relative inline-flex h-2 w-2 rounded-full", dotCls)} />
            </span>
          )}
          {isCompleted && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
          {isFailed && <AlertCircle className="h-3 w-3 text-red-500" />}

          <span className={cn("text-xs font-medium whitespace-nowrap", textCls)}>
            PymesHub IA · {statusText}
          </span>

          <ChevronDown className={cn("h-3 w-3 opacity-40 transition-transform", expanded && "rotate-180")} />
        </div>

        <div className={`h-px flex-1 ${lineCls}`} />
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-2 ml-6 space-y-1.5">
          {run.intent && (
            <p className="text-[11px] text-muted-foreground">
              Intención: <span className="font-medium text-foreground">{getIntentLabel(run.intent)}</span>
            </p>
          )}

          {isRunning && pending_fields.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Pendiente: <span className="text-amber-600 dark:text-amber-400">{pending_fields.join(", ")}</span>
            </p>
          )}

          {steps.slice(-3).map((step, i) => (
            <p key={i} className="text-[10px] text-muted-foreground/60">
              {step.label || step.type.replace(/_/g, " ").toLowerCase()}
            </p>
          ))}

          <div className="flex items-center gap-3 pt-1">
            {isRunning && (
              <button
                onClick={(e) => { e.stopPropagation(); stopMut.mutate(); }}
                disabled={stopMut.isPending}
                className="text-[11px] text-destructive hover:underline"
              >
                Detener
              </button>
            )}
            {!isRunning && (
              <button
                onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
                className="text-[11px] text-muted-foreground hover:underline"
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
