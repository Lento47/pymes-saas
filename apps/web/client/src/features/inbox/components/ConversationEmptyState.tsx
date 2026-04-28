import { InboxIcon } from "lucide-react";
import type { ChannelTab } from "../types";

export function ConversationEmptyState({ channelTab }: { channelTab: ChannelTab }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <InboxIcon className="h-10 w-10 text-muted-foreground/80" />
      <h3 className="mt-4 text-sm font-semibold text-foreground">
        {channelTab === "UNASSIGNED"
          ? "Sin conversaciones sin asignar"
          : "Sin conversaciones"}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground/70">
        {channelTab === "UNASSIGNED"
          ? "Todas las conversaciones tienen un agente asignado."
          : "Creá una nueva con el botón de arriba."}
      </p>
    </div>
  );
}
