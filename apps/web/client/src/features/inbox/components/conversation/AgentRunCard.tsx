import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  Bot,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  ExternalLink,
  Loader2,
  ShieldCheck,
  X,
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

const INTENT_LABELS: Record<string, string> = {
  ORDER: "Order request",
  APPOINTMENT: "Appointment request",
  QUOTE: "Quote request",
  COMPLAINT: "Support complaint",
  INVOICE: "Invoice request",
  SUPPORT: "Support request",
  SALES: "Sales request",
};

const FIELD_LABELS: Record<string, string> = {
  product: "Product",
  service: "Service",
  delivery_type: "Delivery",
  address: "Address",
  time: "Time",
  date: "Date",
  quantity: "Quantity",
  special_reqs: "Requirements",
  issue: "Issue",
  order_ref: "Reference",
  email: "Email",
  phone: "Phone",
  customer_name: "Customer name",
  tax_id: "Tax ID",
  amount: "Amount",
};

const STEP_LABELS: Record<string, string> = {
  CLASSIFY_INTENT: "Identifying customer intent",
  LOAD_CUSTOMER_CONTEXT: "Checking customer context",
  SEARCH_KNOWLEDGE_BASE: "Reviewing business knowledge",
  CHECK_REQUIRED_FIELDS: "Checking required fields",
  FIELD_COLLECTED: "Collected required detail",
  PREPARE_DRAFT: "Preparing recommendation",
  ARTIFACT_CREATED: "Prepared draft action",
  AWAITING_REVIEW: "Waiting for review",
  DONE: "Recommendation ready",
  FAILED: "Agent stopped",
};

const RUNNING_FALLBACK_STATES = [
  "Reviewing recent messages",
  "Checking customer context",
  "Identifying customer intent",
  "Checking required fields",
  "Preparing recommendation",
];

interface Props {
  run: AgentRun;
  conversationId: string;
}

function formatFieldName(field: string) {
  return FIELD_LABELS[field] ?? field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getStepLabel(step: AgentStep) {
  return STEP_LABELS[step.type] ?? step.label ?? step.type.replace(/_/g, " ").toLowerCase();
}

function getCurrentAgentStatus(run: AgentRun, steps: AgentStep[], pendingFields: string[]) {
  if (run.status === "COMPLETED") return "Recommendation ready";
  if (run.status === "FAILED") return "Agent stopped";
  if (run.status === "CANCELLED") return "Agent cancelled";

  const lastStep = steps[steps.length - 1];
  if (lastStep?.type) {
    if (lastStep.type === "FIELD_COLLECTED" && pendingFields[0]) {
      return `Checking ${formatFieldName(pendingFields[0]).toLowerCase()}`;
    }
    return getStepLabel(lastStep);
  }

  const startedAt = new Date(run.started_at).getTime();
  const bucket = Number.isFinite(startedAt)
    ? Math.floor((Date.now() - startedAt) / 2500) % RUNNING_FALLBACK_STATES.length
    : 0;
  return RUNNING_FALLBACK_STATES[bucket];
}

export function AgentRunCard({ run, conversationId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const status = run?.status;
  const collected = run?.collected ?? {};
  const pendingFields = Array.isArray(run?.pending_fields) ? run.pending_fields : [];
  const steps = Array.isArray(run?.steps) ? run.steps : [];
  const artifact = run?.artifact ?? null;

  useEffect(() => {
    if (status === "COMPLETED") {
      const t = setTimeout(() => setDismissed(true), 12000);
      return () => clearTimeout(t);
    }
  }, [status]);

  const stopMut = useMutation({
    mutationFn: () => api.stopAgentRun(conversationId),
    onSuccess: () => {
      qc.setQueryData(["agent-run", conversationId], null);
      toast({ title: "Agent stopped" });
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
  const collectedEntries = Object.entries(collected).filter(([, v]) => v && v !== "N/A");
  const intentLabel = INTENT_LABELS[run.intent] ?? run.intent ?? "Agent run";

  return (
    <div
      className={cn(
        "mx-3 mb-2 overflow-hidden rounded-xl border text-sm transition-all sm:mx-4",
        isCompleted
          ? "border-emerald-500/25 bg-emerald-500/[0.04]"
          : isFailed
            ? "border-destructive/25 bg-destructive/[0.04]"
            : "border-primary/20 bg-primary/[0.04]",
      )}
    >
      <div className="flex items-start gap-2.5 px-3 py-2.5 sm:items-center">
        <div
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border sm:mt-0",
            isCompleted
              ? "border-emerald-500/25 bg-emerald-500/10"
              : isFailed
                ? "border-destructive/25 bg-destructive/10"
                : "border-primary/25 bg-primary/10",
          )}
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : isCompleted ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : isFailed ? (
            <AlertCircle className="h-4 w-4 text-destructive" />
          ) : (
            <Bot className="h-4 w-4 text-primary" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-1.5">
            <span
              className={cn(
                "font-medium leading-tight",
                isCompleted ? "text-emerald-600" : isFailed ? "text-destructive" : "text-primary",
              )}
            >
              AI Agent
            </span>
            <span className="hidden text-muted-foreground sm:inline">—</span>
            <span className="truncate text-xs text-muted-foreground sm:text-sm">{intentLabel}</span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate leading-snug">{currentStatus}</span>
            {isRunning && pendingFields.length > 0 && (
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                {pendingFields.length} missing
              </span>
            )}
            {isCompleted && (
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                Review ready
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
            title={expanded ? "Hide details" : "View details"}
            aria-label={expanded ? "Hide details" : "View details"}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {isRunning && (
            <button
              onClick={() => stopMut.mutate()}
              disabled={stopMut.isPending}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-60"
              title="Stop agent"
              aria-label="Stop agent"
            >
              {stopMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            </button>
          )}
          {!isRunning && (
            <button
              onClick={() => setDismissed(true)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
              title="Dismiss"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {isRunning && (
        <div className="mx-3 mb-2 h-1 overflow-hidden rounded-full bg-background/70">
          <div className="h-full w-1/2 animate-[pulse_1.4s_ease-in-out_infinite] rounded-full bg-primary/45" />
        </div>
      )}

      {(collectedEntries.length > 0 || pendingFields.length > 0) && (
        <div className="grid gap-2 px-3 pb-2 sm:grid-cols-2">
          {collectedEntries.length > 0 && (
            <div className="rounded-lg border border-border/50 bg-background/45 p-2">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70">
                <ClipboardCheck className="h-3.5 w-3.5" />
                Collected
              </div>
              <div className="flex flex-wrap gap-1.5">
                {collectedEntries.slice(0, 6).map(([key, val]) => (
                  <span
                    key={key}
                    className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/50 bg-background/70 px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                    <span className="font-medium text-foreground/70">{formatFieldName(key)}:</span>
                    <span className="truncate">{val}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {pendingFields.length > 0 && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] p-2">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-amber-700 dark:text-amber-300">
                <AlertCircle className="h-3.5 w-3.5" />
                Missing details
              </div>
              <div className="flex flex-wrap gap-1.5">
                {pendingFields.slice(0, 6).map((field) => (
                  <span
                    key={field}
                    className="rounded-md border border-amber-500/20 bg-background/65 px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {formatFieldName(field)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isCompleted && artifact && (
        <div className="mx-3 mb-2 rounded-lg border border-emerald-500/20 bg-background/55 px-3 py-2">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{artifact.title}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Prepared by AI. Review before taking sensitive actions.</p>
            </div>
            <a
              href="/tasks"
              className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-600 transition-colors hover:text-emerald-500"
            >
              View <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}

      {expanded && (
        <div className="border-t border-border/30 px-3 py-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70">Agent activity</span>
            {isRunning && <span className="text-[11px] text-muted-foreground/60">No sensitive action will run automatically.</span>}
          </div>

          {steps.length > 0 ? (
            <div className="space-y-1.5">
              {steps.map((step, i) => {
                const isArtifact = step.type === "ARTIFACT_CREATED";
                const isCollected = step.type === "FIELD_COLLECTED";
                return (
                  <div key={`${step.type}-${step.at}-${i}`} className="flex items-start gap-2 text-xs">
                    <div className="mt-0.5 shrink-0">
                      {isArtifact ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : isCollected ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary/70" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                      )}
                    </div>
                    <span className="leading-snug text-muted-foreground">{getStepLabel(step)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
              <Loader2 className={cn("h-3.5 w-3.5 shrink-0", isRunning && "animate-spin")} />
              <span>{isRunning ? currentStatus : "No activity details available."}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
