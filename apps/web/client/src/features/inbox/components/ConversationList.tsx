import { InboxIcon } from "lucide-react";
import type { ChannelTab, InboxConversation } from "../types";
import { ConversationListItem } from "./ConversationListItem";
import { ConversationEmptyState } from "./ConversationEmptyState";

function ConversationListSkeleton() {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl bg-foreground/[0.03] p-4">
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-full bg-white/[0.06]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 rounded bg-white/[0.06]" />
              <div className="h-3 w-full rounded bg-foreground/[0.04]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConversationList({
  conversations,
  isLoading,
  selectedId,
  onSelect,
  channelTab,
}: {
  conversations: InboxConversation[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  channelTab: ChannelTab;
}) {
  return (
    <section className="flex min-h-0 flex-col rounded-panel border border-border bg-[#0D1424] shadow-panel">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Conversaciones</h2>
          <p className="text-xs text-slate-500">
            {conversations.length} encontradas
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <ConversationListSkeleton />
        ) : conversations.length === 0 ? (
          <ConversationEmptyState channelTab={channelTab} />
        ) : (
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <ConversationListItem
                key={conversation.id}
                conversation={conversation}
                selected={conversation.id === selectedId}
                onClick={() => onSelect(conversation.id)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
