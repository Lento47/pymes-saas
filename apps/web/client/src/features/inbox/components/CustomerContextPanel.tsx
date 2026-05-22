import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { InboxConversation } from "../types";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardList, TrendingUp, MessageCircle, Receipt, Target,
  Loader2, ChevronDown, ChevronUp, User, Hash, Copy, ExternalLink, UserPlus,
} from "lucide-react";

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  OPEN:     { label: "Abierto",   cls: "bg-emerald-500/10 text-emerald-400" },
  RESOLVED: { label: "Resuelto",  cls: "bg-blue-500/10 text-blue-400" },
  PENDING:  { label: "Pendiente", cls: "bg-amber-500/10 text-amber-400" },
};

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.12em] mb-2">
      {label}
    </p>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground/70">{label}</p>
      <p className="text-[12px] text-foreground leading-snug">{value}</p>
    </div>
  );
}

export function CustomerContextPanel({
  conversation,
  onAddContact,
}: {
  conversation: InboxConversation | null;
  onAddContact?: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showMetrics, setShowMetrics] = useState(false);

  if (!conversation) {
    return (
      <aside className="bg-background border-l border-border flex flex-col items-center justify-center p-6">
        <User className="w-8 h-8 text-muted-foreground/20 mb-3" />
        <p className="text-[12px] text-muted-foreground/60 text-center leading-relaxed">
          Seleccioná una conversación para ver el contexto del cliente.
        </p>
      </aside>
    );
  }

  const contactId = conversation.contact?.id;
  const status = conversation.status ?? "OPEN";
  const statusStyle = STATUS_STYLES[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  const assignedUser = (conversation as any)?.assigned_user;

  return (
    <aside className="min-h-0 overflow-y-auto bg-background border-l border-border">
      {/* Contact section */}
      <div className="px-4 pt-4 pb-3 border-b border-border/40 space-y-2.5">
        <SectionHeader label="Contacto" />
        <DataRow label="Nombre" value={conversation.contact?.full_name || "—"} />
        {conversation.contact?.email && (
          <DataRow label="Email" value={conversation.contact.email} />
        )}
        {(conversation.contact as any)?.phone && (
          <DataRow label="Teléfono" value={(conversation.contact as any).phone} />
        )}
        <DataRow label="Canal" value={conversation.channel?.name || "—"} />
        {!contactId && onAddContact && (
          <button
            type="button"
            onClick={onAddContact}
            className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted/40"
          >
            <UserPlus className="h-3 w-3 text-muted-foreground" />
            Agregar contacto
          </button>
        )}
      </div>

      {/* Conversation state section */}
      <div className="px-4 py-3 border-b border-border/40 space-y-2.5">
        <SectionHeader label="Conversación" />
        <div className="flex flex-wrap gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle.cls}`}>
            {statusStyle.label}
          </span>
          {!assignedUser && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400/80">
              Sin asignar
            </span>
          )}
        </div>
        {assignedUser && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="w-2.5 h-2.5 text-primary" />
            </div>
            <span className="text-[12px] text-foreground">{assignedUser.name}</span>
          </div>
        )}
        {(conversation as any)?.external_id && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
            <Hash className="w-2.5 h-2.5 shrink-0" />
            <span className="font-mono truncate">{(conversation as any).external_id}</span>
          </div>
        )}
      </div>

      {/* Quick actions */}
      {(contactId || (conversation as any)?.external_id) && (
        <div className="px-4 py-3 border-b border-border/40 space-y-1.5">
          <SectionHeader label="Acciones" />
          <div className="flex flex-wrap gap-1.5">
            {(conversation as any)?.external_id && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText((conversation as any).external_id);
                  toast({ title: "ID copiado" });
                }}
                className="flex items-center gap-1 rounded-md border border-border/50 bg-muted/20 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                <Copy className="w-2.5 h-2.5 shrink-0" />
                Copiar ID externo
              </button>
            )}
            {contactId && (
              <a
                href={`/contacts/${contactId}`}
                className="flex items-center gap-1 rounded-md border border-border/50 bg-muted/20 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                Ver en contactos
              </a>
            )}
          </div>
        </div>
      )}

      {/* Metrics section */}
      {contactId && (
        <div className="px-4 py-3">
          <button
            type="button"
            onClick={() => setShowMetrics(!showMetrics)}
            className="w-full flex items-center justify-between gap-2 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" />
              Dashboard del cliente
            </span>
            {showMetrics ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showMetrics && <ClientMetrics contactId={contactId} queryClient={queryClient} />}
        </div>
      )}
    </aside>
  );
}

function ClientMetrics({ contactId, queryClient }: { contactId: string; queryClient: Record<string, any> }) {
  const { data: metrics, isLoading, isError } = useQuery({
    queryKey: ["contact-metrics", contactId],
    queryFn: () => api.getContactMetrics(contactId),
    enabled: !!contactId,
  });

  const extractMut = useMutation({
    mutationFn: () => api.extractContactData(contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-metrics", contactId] });
    },
  });

  if (isLoading) {
    return (
      <div className="mt-3 space-y-2 animate-pulse">
        <div className="h-7 bg-muted/30 rounded-lg" />
        <div className="h-7 bg-muted/30 rounded-lg" />
        <div className="h-7 bg-muted/30 rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return <p className="mt-3 text-[11px] text-muted-foreground/70">Error al cargar métricas.</p>;
  }

  const m = metrics || {};

  return (
    <div className="mt-3 space-y-4">
      <div className="grid grid-cols-2 gap-1.5">
        <MetricBadge icon={MessageCircle} label="Conversaciones" value={m.conversation_count ?? 0} />
        <MetricBadge icon={TrendingUp} label="Mensajes" value={m.total_messages ?? 0} />
        <MetricBadge icon={Receipt} label="Facturas" value={m.invoice_count ?? 0} />
        <MetricBadge icon={Target} label="Deals" value={m.deal_count ?? 0} />
      </div>

      {(m.total_invoice_amount > 0 || m.total_deal_value > 0) && (
        <div className="space-y-1 text-[10px]">
          {m.total_invoice_amount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Total facturado</span>
              <span className="text-foreground font-medium">
                {new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(m.total_invoice_amount)}
              </span>
            </div>
          )}
          {m.total_deal_value > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Valor pipeline</span>
              <span className="text-foreground font-medium">
                {new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(m.total_deal_value)}
              </span>
            </div>
          )}
        </div>
      )}

      {m.extracted_data && Object.keys(m.extracted_data).length > 1 && (
        <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
            Datos extraídos
          </p>
          {m.extracted_data.location && <ExtractedRow label="Ubicación" value={m.extracted_data.location} />}
          {m.extracted_data.business_needs?.length > 0 && <ExtractedRow label="Necesidades" value={m.extracted_data.business_needs.join(", ")} />}
          {m.extracted_data.product_interests?.length > 0 && <ExtractedRow label="Intereses" value={m.extracted_data.product_interests.join(", ")} />}
          {m.extracted_data.order_history?.length > 0 && <ExtractedRow label="Pedidos" value={m.extracted_data.order_history.join(", ")} />}
          {m.extracted_data.budget_range && <ExtractedRow label="Presupuesto" value={m.extracted_data.budget_range} />}
          {m.extracted_data.decision_timeline && <ExtractedRow label="Decisión" value={m.extracted_data.decision_timeline} />}
          {m.extracted_data.notes && <ExtractedRow label="Notas" value={m.extracted_data.notes} />}
          {m.extracted_data.last_extraction_at && (
            <p className="text-[10px] text-muted-foreground/40 mt-1">
              Act. {new Date(m.extracted_data.last_extraction_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => extractMut.mutate()}
        disabled={extractMut.isPending}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
      >
        {extractMut.isPending ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            Analizando...
          </>
        ) : (
          <>
            <ClipboardList className="w-3 h-3" />
            Extraer datos del cliente
          </>
        )}
      </button>

      {extractMut.isError && (
        <p className="text-[11px] text-destructive">
          {extractMut.error instanceof Error ? extractMut.error.message : "Error al extraer datos."}
        </p>
      )}
    </div>
  );
}

function MetricBadge({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1.5">
      <Icon className="w-3 h-3 text-primary/50 shrink-0" />
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-foreground leading-none">{value}</p>
        <p className="text-[9px] text-muted-foreground/60 truncate mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function ExtractedRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground/60">{label}</p>
      <p className="text-[11px] text-foreground/85 leading-relaxed">{value}</p>
    </div>
  );
}
