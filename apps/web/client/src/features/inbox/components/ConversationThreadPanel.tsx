import { InboxIcon, ArrowUp } from "lucide-react";

export function ConversationThreadPanel({
  conversationId,
  conversation,
}: {
  conversationId: string | null;
  conversation?: any;
}) {
  if (!conversationId || !conversation) {
    return (
      <section className="flex items-center justify-center bg-background">
        <div className="text-center px-8 max-w-[280px]">
          <InboxIcon className="mx-auto h-10 w-10 text-muted-foreground/65" />
          <h3 className="mt-4 text-sm font-medium text-foreground">
            Seleccioná una conversación
          </h3>
          <p className="mt-2 text-[13px] text-muted-foreground/80 leading-relaxed">
            Elegí una conversación para ver el historial y responder.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-col bg-background">
      {/* Conversation header */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-3 shrink-0">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[12px] font-semibold text-primary shrink-0">
          {conversation.contact?.full_name?.charAt(0) || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-foreground truncate">
            {conversation.contact?.full_name || "Desconocido"}
          </p>
          <p className="text-[11px] text-muted-foreground/80 truncate">
            {conversation.channel?.name || "Sin canal"}
          </p>
        </div>
      </div>

      {/* Messages area */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="text-center text-[13px] text-muted-foreground/80 mt-12">
          El historial de mensajes se cargará aquí.
        </div>
      </div>

      {/* Message composer */}
      <div className="border-t border-border p-4 shrink-0">
        <div className="flex items-center gap-2">
          <input
            placeholder="Escribí tu mensaje..."
            className="flex-1 h-9 rounded-xl border border-border bg-muted/30 px-4 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/80 focus:border-primary/30 transition-colors"
          />
          <button className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity">
            <ArrowUp className="h-4 w-4 text-primary-foreground" />
          </button>
        </div>
      </div>
    </section>
  );
}
