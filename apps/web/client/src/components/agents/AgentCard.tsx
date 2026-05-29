import { useState } from "react";
import { Link } from "wouter";
import { Bot, Pencil, Play, StopCircle, Trash2 } from "lucide-react";
import { AgentStatusBadge } from "./AgentStatusBadge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";

interface AgentCardProps {
  agent: Record<string, any>;
  onActivate: (id: string) => void;
  onDeactivate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function AgentCard({ agent, onActivate, onDeactivate, onDelete }: AgentCardProps) {
  const isActive = agent.status === "ACTIVE";
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          "group relative rounded-xl border bg-card/60 overflow-hidden transition-colors duration-150",
          "hover:border-border/80 hover:bg-card",
        )}
      >
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-muted-foreground shrink-0" />
              <Link href={`/agents/${agent.id}`}>
                <span className="text-sm font-semibold text-foreground hover:text-primary cursor-pointer">
                  {agent.name}
                </span>
              </Link>
            </div>
            <AgentStatusBadge status={agent.status} />
          </div>
          {agent.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
              {agent.description}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground/50 font-mono">
            {agent.channel_scope} · {agent.provider}
          </p>
        </div>
        <div className="absolute top-3 right-3 flex gap-0.5">
          <Link href={`/agents/${agent.id}`}>
            <button
              className="p-1.5 rounded-lg bg-card border border-border hover:bg-accent transition-colors"
              title="Configurar"
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </Link>
          {isActive ? (
            <button
              onClick={() => onDeactivate(agent.id)}
              className="p-1.5 rounded-lg bg-card border border-border hover:bg-accent transition-colors"
              title="Desactivar"
            >
              <StopCircle className="h-3.5 w-3.5 text-amber-400" />
            </button>
          ) : (
            <button
              onClick={() => onActivate(agent.id)}
              className="p-1.5 rounded-lg bg-card border border-border hover:bg-accent transition-colors"
              title="Activar"
            >
              <Play className="h-3.5 w-3.5 text-emerald-400" />
            </button>
          )}
          <button
            onClick={() => setConfirmOpen(true)}
            className="p-1.5 rounded-lg bg-card border border-border hover:bg-destructive/10 hover:border-destructive/30 transition-colors"
            title="Eliminar agente"
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Eliminar agente"
        description={`¿Eliminar "${agent.name}"? Esta acción no se puede deshacer. El chatflow en Flowise también será eliminado.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          setConfirmOpen(false);
          onDelete(agent.id);
        }}
      />
    </>
  );
}
