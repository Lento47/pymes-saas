import { InboxIcon } from "lucide-react";
import type { ChannelTab } from "../types";

export function ConversationEmptyState({ channelTab }: { channelTab: ChannelTab }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <InboxIcon className="h-10 w-10 text-slate-600" />
      <h3 className="mt-4 text-sm font-semibold text-white">
        {channelTab === "UNASSIGNED"
          ? "Sin conversaciones sin asignar"
          : "Sin conversaciones"}
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        {channelTab === "UNASSIGNED"
          ? "Todas las conversaciones tienen un agente asignado."
          : "Creá una nueva con el botón de arriba."}
      </p>
    </div>
  );
}
