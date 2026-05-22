import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  Loader2,
  X,
  ExternalLink,
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
  intent: "ORDER" | "APPOINTMENT" | "QUOTE" | "COMPLAINT";
  started_at: string;
  collected: Record<string, string | null>;
  pending_fields: string[];
  steps: AgentStep[];
  artifact: AgentArtifact | null;
}

const INTENT_LABELS: Record<string, string> = {
  ORDER: "Pedido",
  APPOINTMENT: "Cita",
  QUOTE: "Cotización",
  COMPLAINT: "Reclamo",
};

const FIELD_LABELS: Record<string, string> = {
  product: "Producto",
  service: "Servicio",
  delivery_type: "Entrega",
  address: "Dirección",
  time: "Horario",
  date: "Fecha",
  quantity: "Cantidad",
  special_reqs: "Requerimientos",
  issue: "Problema",
  order_ref: "Referencia",
};

interface Props {
  run: AgentRun;
  conversationId: string;
}

export function AgentRunCard({ run, conversationId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  // Auto-dismiss completed run after 8 seconds
  useEffect(() => {
    if (run.status === "COMPLETED") {
      const t = setTimeout(() => setDismissed(true), 8000);
      return () => clearTimeout(t);
    }
  }, [run.status]);

  const stopMut = useMutation({
    mutationFn: () => api.stopAgentRun(conversationId),
    onSuccess: () => {
      qc.setQueryData(["agent-run", conversationId], null);
      toast({ title: "Agente detenido" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (dismissed || run.status === "CANCELLED") return null;

  const isRunning = run.status === "RUNNING";
  const isCompleted = run.status === "COMPLETED";
  const collectedEntries = Object.entries(run.collected).filter(([, v]) => v && v !== "N/A");
  const intentLabel = INTENT_LABELS[run.intent] ?? run.intent;
  const currentField = run.pending_fields[0];

  return (
    <div
      className={cn(
        "mx-3 mb-2 rounded-xl border text-sm overflow-hidden transition-all",
        isCompleted
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-[rgba(139,92,246,0.25)] bg-[rgba(139,92,246,0.05)]",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
            isCompleted ? "bg-emerald-500/15" : "bg-primary/15",
          )}
        >
          {isRunning ? (
            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
          ) : (
            <Bot className={cn("w-3.5 h-3.5", isCompleted ? "text-emerald-400" : "text-primary")} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <span className={cn("font-medium", isCompleted ? "text-emerald-400" : "text-primary")}>
            Agente IA
          </span>
          <span className="text-muted-foreground ml-1.5">
            — {intentLabel}
          </span>
          {isRunning && currentField && (
            <span className="text-muted-foreground/70 ml-1">
              · Esperando {FIELD_LABELS[currentField] ?? currentField}
            </span>
          )}
          {isCompleted && (
            <span className="text-emerald-400/80 ml-1">· Completado</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
            title={expanded ? "Ocultar pasos" : "Ver pasos"}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {isRunning && (
            <button
              onClick={() => stopMut.mutate()}
              disabled={stopMut.isPending}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors"
              title="Detener agente"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {isCompleted && (
            <button
              onClick={() => setDismissed(true)}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Collected data chips */}
      {collectedEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {collectedEntries.map(([key, val]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded-full bg-background/50 border border-border/50 px-2 py-0.5 text-xs text-muted-foreground"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="font-medium text-foreground/70">{FIELD_LABELS[key] ?? key}:</span>
              <span>{val}</span>
            </span>
          ))}
        </div>
      )}

      {/* Artifact when completed */}
      {isCompleted && run.artifact && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-emerald-300 text-xs font-medium flex-1 truncate">{run.artifact.title}</span>
          <a
            href="/tasks"
            className="flex items-center gap-1 text-xs text-emerald-400/70 hover:text-emerald-300 transition-colors"
          >
            Ver tarea <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Expanded steps */}
      {expanded && run.steps.length > 0 && (
        <div className="border-t border-border/30 px-3 py-2 space-y-1.5">
          {run.steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <div className="mt-0.5 shrink-0">
                {step.type === "ARTIFACT_CREATED" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : step.type === "FIELD_COLLECTED" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary/60" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-muted-foreground/40" />
                )}
              </div>
              <span className="text-muted-foreground leading-snug">{step.label}</span>
            </div>
          ))}
          {isRunning && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Esperando respuesta del cliente...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
