import { InboxIcon } from "lucide-react";

export function ConversationThreadPanel({
  conversationId,
}: {
  conversationId: string | null;
}) {
  if (!conversationId) {
    return (
      <section className="flex items-center justify-center rounded-panel border border-border bg-[#0D1424]">
        <div className="text-center px-8">
          <InboxIcon className="mx-auto h-12 w-12 text-slate-600" />
          <h3 className="mt-4 text-sm font-semibold text-white">
            Seleccioná una conversación
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Elegí una conversación para ver el historial y responder.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-col rounded-panel border border-border bg-[#0D1424] shadow-panel">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Conversación</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <p className="text-center text-sm text-slate-500 mt-12">
          El historial de mensajes se cargará aquí.
        </p>
      </div>

      <div className="border-t border-border p-4">
        <textarea
          placeholder="Escribí tu mensaje..."
          className="min-h-[80px] w-full resize-none rounded-2xl border border-border bg-black/20 p-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-brand-indigo/60"
        />
        <div className="mt-3 flex justify-end">
          <button className="rounded-full bg-gradient-to-r from-brand-indigo to-brand-violet px-4 py-2 text-xs font-semibold text-white">
            Enviar
          </button>
        </div>
      </div>
    </section>
  );
}
