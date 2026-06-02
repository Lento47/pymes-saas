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
  Wrench,
  FileText,
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

const STEP_LABELS: Record<string, string> = {
  CLASSIFY_INTENT: "Identificando intención",
  LOAD_CUSTOMER_CONTEXT: "Revisando contexto",
  SEARCH_KNOWLEDGE_BASE: "Buscando en base de conocimiento",
  CHECK_REQUIRED_FIELDS: "Verificando campos",
  FIELD_COLLECTED: "Campo recolectado",
  PREPARE_DRAFT: "Preparando respuesta",
  ARTIFACT_CREATED: "Borrador listo",
  AWAITING_REVIEW: "Esperando revisión",
  DONE: "Listo",
  FAILED: "Detenido",
};

const RUNNING_FALLBACK_STATES = [
  "Revisando mensajes",
  "Analizando contexto",
  "Identificando intención",
  "Preparando respuesta",
];

function getStepLabel(step: AgentStep) {
  return STEP_LABELS[step.type] ?? step.label ?? step.type.replace(/_/g, " ").toLowerCase();
}

function getCurrentAgentStatus(run: AgentRun, steps: AgentStep[], pendingFields: string[]) {
  if (run.status === "COMPLETED") return "Respuesta lista";
  if (run.status === "FAILED") return "Agente detenido";
  if (run.status === "CANCELLED") return "Cancelado";

  const lastStep = steps[steps.length - 1];
  if (lastStep?.type) {
    return getStepLabel(lastStep);
  }

  const startedAt = new Date(run.started_at).getTime();
  const bucket = Number.isFinite(startedAt)
    ? Math.floor((Date.now() - startedAt) / 2500) % RUNNING_FALLBACK_STATES.length
    : 0;
  return RUNNING_FALLBACK_STATES[bucket];
}

function getStatusIcon(run: AgentRun, stepType?: string) {
  if (run.status === "COMPLETED") return <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
  if (run.status === "FAILED") return <AlertCircle className="h-3 w-3 text-destructive" />;

  if (stepType) {
    if (stepType.includes("SEARCH") || stepType.includes("LOAD") || stepType.includes("CONTEXT")) {
      return <Brain className="h-3 w-3 text-violet-500 animate-pulse" />;
    }
    if (stepType.includes("DRAFT") || stepType.includes("PREPARE") || stepType.includes("ARTIFACT")) {
      return <FileText className="h-3 w-3 text-amber-500 animate-pulse" />;
    }
    if (stepType.includes("FIELD") || stepType.includes("CHECK")) {
      return <Wrench className="h-3 w-3 text-blue-500 animate-pulse" />;
    }
  }

  return <Loader2 className="h-3 w-3 text-primary animate-spin" />;
}

interface Props {
  run: AgentRun;
  conversationId: string;
}

export function AgentRunCard({ run, conversationId }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const status = run?.status;
  const steps = Array.isArray(run?.steps) ? run.steps : [];
  const pendingFields = Array.isArray(run?.pending_fields) ? run.pending_fields : [];

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

  const currentStatus = useMemo(
    () => (run ? getCurrentAgentStatus(run, steps, pendingFields) : ""),
    [run, steps, pendingFields],
  );

  if (!run?.id || !status) return null;
  if (dismissed || status === "CANCELLED") return null;

  const isRunning = status === "RUNNING";
  const isCompleted = status === "COMPLETED";
  const isFailed = status === "FAILED";
  const lastStep = steps[steps.length - 1];

  return (
    <div className="ml-8 flex items-center gap-1.5 px-2 py-1.5 sm:ml-10 sm:px-3">
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl rounded-bl-md px-3 py-1.5 text-xs transition-all",
          isCompleted
            ? "bg-emerald-500/[0.08] border border-emerald-500/20"
            : isFailed
              ? "bg-destructive/[0.06] border border-destructive/20"
              : "bg-violet-500/[0.06] border border-violet-500/15",
        )}
      >
        {getStatusIcon(run, lastStep?.type)}

        <span
          className={cn(
            "max-w-[200px] truncate leading-snug",
            isCompleted ? "text-emerald-700 dark:text-emerald-400" : isFailed ? "text-destructive" : "text-violet-700 dark:text-violet-400",
          )}
        >
          {currentStatus}
        </span>

        {isRunning && pendingFields.length > 0 && (
          <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
            {pendingFields.length}
          </span>
        )}

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
