import type { InboxConversation } from "../types";
import { AvatarFallback } from "@/components/shared/avatar-fallback";

export function CustomerContextPanel({
  conversation,
}: {
  conversation: InboxConversation | null;
}) {
  if (!conversation) {
    return (
      <aside className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground/70 text-center mt-8">
          Seleccioná una conversación para ver el contexto del cliente.
        </p>
      </aside>
    );
  }

  const contact = conversation.contact;

  return (
    <aside className="min-h-0 overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-sm space-y-4">
      <section className="rounded-card border border-border bg-foreground/[0.03] p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
          Información del contacto
        </p>

        <div className="mt-4 flex items-center gap-3">
          <AvatarFallback name={contact?.full_name || contact?.name || "Cliente"} />
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {contact?.full_name || contact?.name || "Cliente desconocido"}
            </h3>
            <p className="text-xs text-muted-foreground/70">
              {contact?.company || "Sin empresa"}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          {contact?.phone && <p>{contact.phone}</p>}
          {contact?.email && <p>{contact.email}</p>}
        </div>
      </section>

      <section className="rounded-card border border-border bg-foreground/[0.03] p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
          Actividad reciente
        </p>
        <p className="mt-3 text-sm text-muted-foreground">Sin actividad todavía.</p>
      </section>
    </aside>
  );
}
