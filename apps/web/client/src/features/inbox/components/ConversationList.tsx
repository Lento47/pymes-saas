import type { ChannelTab, InboxConversation } from "../types";
import { ConversationListItem } from "./ConversationListItem";
import { ConversationEmptyState } from "./ConversationEmptyState";

function ConversationListSkeleton() {
  return (
    <div className="space-y-2 px-3 py-3 md:space-y-0 md:px-0 md:py-1">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-border/50 bg-card px-3 py-3 md:rounded-none md:border-x-0 md:border-t-0 md:px-4">
          <div className="flex gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-muted/60" />
            <div className="flex-1 space-y-2 pt-0.5">
              <div className="h-3 w-28 rounded bg-muted/60" />
              <div className="h-3 w-24 rounded bg-muted/40" />
              <div className="h-3 w-3/4 rounded bg-muted/30" />
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
    <section className="flex min-h-0 flex-col bg-muted/20 md:bg-card">
      <div className="hidden shrink-0 items-center justify-between border-b border-border px-4 py-3 md:flex">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Conversaciones</h2>
          {!isLoading && (
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              {conversations.length} {conversations.length === 1 ? "encontrada" : "encontradas"}
            </p>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto minimal-scrollbar">
        {isLoading ? (
          <ConversationListSkeleton />
        ) : conversations.length === 0 ? (
          <ConversationEmptyState channelTab={channelTab} />
        ) : (
          <div className="space-y-2 px-3 py-3 md:space-y-0 md:px-0 md:py-0">
            {conversations.map((conversation) => (
              <ConversationListItem
                key={conversation.id}
                conversation={conversation}
                selected={conversation.id === selectedId}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
