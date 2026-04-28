export function CustomerContextPanel({
  conversation,
}: {
  conversation: any;
}) {
  if (!conversation) {
    return (
      <aside className="bg-background border-l border-border p-5">
        <p className="text-[13px] text-muted-foreground/50 text-center mt-8 leading-relaxed">
          Seleccioná una conversación para ver el contexto del cliente.
        </p>
      </aside>
    );
  }

  return (
    <aside className="bg-background border-l border-border p-5">
      <h3 className="text-[12px] font-medium text-muted-foreground/60 uppercase tracking-[0.1em] mb-4">Contacto</h3>

      <div className="space-y-3">
        <div>
          <p className="text-[11px] text-muted-foreground/50">Nombre</p>
          <p className="text-[13px] text-foreground">{conversation.contact?.full_name || "—"}</p>
        </div>
        {conversation.contact?.email && (
          <div>
            <p className="text-[11px] text-muted-foreground/50">Email</p>
            <p className="text-[13px] text-foreground">{conversation.contact.email}</p>
          </div>
        )}
        <div>
          <p className="text-[11px] text-muted-foreground/50">Canal</p>
          <p className="text-[13px] text-foreground">{conversation.channel?.name || "—"}</p>
        </div>
        {conversation.assigned_user && (
          <div>
            <p className="text-[11px] text-muted-foreground/50">Asignado a</p>
            <p className="text-[13px] text-foreground">{conversation.assigned_user.name}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
