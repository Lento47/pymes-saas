import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sparkles, TrendingUp, MessageCircle, Receipt, Target, Loader2, RefreshCw } from "lucide-react";

export function CustomerContextPanel({
  conversation,
}: {
  conversation: Record<string, any>;
}) {
  const queryClient = useQueryClient();
  const [showMetrics, setShowMetrics] = useState(false);

  if (!conversation) {
    return (
      <aside className="bg-background border-l border-border p-5">
        <p className="text-[13px] text-muted-foreground/80 text-center mt-8 leading-relaxed">
          Seleccioná una conversación para ver el contexto del cliente.
        </p>
      </aside>
    );
  }

  const contactId = conversation.contact?.id;

  return (
    <aside className="min-h-0 overflow-y-auto bg-background border-l border-border p-5 space-y-5">
      <h3 className="text-[12px] font-medium text-muted-foreground/60 uppercase tracking-[0.1em] mb-4">Contacto</h3>

      <div className="space-y-3">
        <div>
          <p className="text-[11px] text-muted-foreground/80">Nombre</p>
          <p className="text-[13px] text-foreground">{conversation.contact?.full_name || "—"}</p>
        </div>
        {conversation.contact?.email && (
          <div>
            <p className="text-[11px] text-muted-foreground/80">Email</p>
            <p className="text-[13px] text-foreground">{conversation.contact.email}</p>
          </div>
        )}
        <div>
          <p className="text-[11px] text-muted-foreground/80">Canal</p>
          <p className="text-[13px] text-foreground">{conversation.channel?.name || "—"}</p>
        </div>
        {conversation.assigned_user && (
          <div>
            <p className="text-[11px] text-muted-foreground/80">Asignado a</p>
            <p className="text-[13px] text-foreground">{conversation.assigned_user.name}</p>
          </div>
        )}
      </div>

      {contactId && (
        <div className="pt-3 border-t border-border/40">
          <button
            onClick={() => setShowMetrics(!showMetrics)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium text-primary hover:bg-primary/5 transition-colors"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Dashboard del Cliente
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
      <div className="mt-3 space-y-3 animate-pulse">
        <div className="h-8 bg-muted/30 rounded" />
        <div className="h-8 bg-muted/30 rounded" />
        <div className="h-8 bg-muted/30 rounded" />
      </div>
    );
  }

  if (isError) {
    return <p className="mt-3 text-[12px] text-muted-foreground">Error al cargar métricas.</p>;
  }

  const m = metrics || {};

  return (
    <div className="mt-3 space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <MetricBadge icon={MessageCircle} label="Conversaciones" value={m.conversation_count ?? 0} />
        <MetricBadge icon={TrendingUp} label="Mensajes" value={m.total_messages ?? 0} />
        <MetricBadge icon={Receipt} label="Facturas" value={m.invoice_count ?? 0} />
        <MetricBadge icon={Target} label="Deals" value={m.deal_count ?? 0} />
      </div>

      {(m.total_invoice_amount > 0 || m.total_deal_value > 0) && (
        <div className="space-y-1.5 text-[11px]">
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
        <div className="rounded-lg border border-border/40 bg-card/40 p-3 space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
            Datos Extraídos
          </p>
          {m.extracted_data.location && (
            <ExtractedRow label="Ubicación" value={m.extracted_data.location} />
          )}
          {m.extracted_data.business_needs?.length > 0 && (
            <ExtractedRow label="Necesidades" value={m.extracted_data.business_needs.join(", ")} />
          )}
          {m.extracted_data.product_interests?.length > 0 && (
            <ExtractedRow label="Intereses" value={m.extracted_data.product_interests.join(", ")} />
          )}
          {m.extracted_data.order_history?.length > 0 && (
            <ExtractedRow label="Pedidos" value={m.extracted_data.order_history.join(", ")} />
          )}
          {m.extracted_data.budget_range && (
            <ExtractedRow label="Presupuesto" value={m.extracted_data.budget_range} />
          )}
          {m.extracted_data.decision_timeline && (
            <ExtractedRow label="Decisión" value={m.extracted_data.decision_timeline} />
          )}
          {m.extracted_data.notes && (
            <ExtractedRow label="Notas" value={m.extracted_data.notes} />
          )}
          {m.extracted_data.last_extraction_at && (
            <p className="text-[10px] text-muted-foreground/50 mt-1">
              Actualizado {new Date(m.extracted_data.last_extraction_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      <button
        onClick={() => extractMut.mutate()}
        disabled={extractMut.isPending}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
      >
        {extractMut.isPending ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            Analizando conversaciones...
          </>
        ) : (
          <>
            <Sparkles className="w-3 h-3" />
            Extraer datos inteligentes
          </>
        )}
      </button>

      {extractMut.isError && (
        <p className="text-[11px] text-destructive">
          {(extractMut.error as any)?.message || "Error al extraer datos."}
        </p>
      )}
    </div>
  );
}

function MetricBadge({ icon: Icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/40 px-3 py-2">
      <Icon className="w-3.5 h-3.5 text-primary/60 shrink-0" />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-foreground leading-none">{value}</p>
        <p className="text-[10px] text-muted-foreground/60 truncate">{label}</p>
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
