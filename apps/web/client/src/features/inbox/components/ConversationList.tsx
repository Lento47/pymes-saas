import type { ChannelTab, InboxConversation } from "../types";
import { ConversationListItem } from "./ConversationListItem";
import { ConversationEmptyState } from "./ConversationEmptyState";
import { Button } from "@/components/arc/button/button";
import type { RefObject } from "react";

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
  isError, isFetching, onRetry, total, page, pages, onPageChange, scrollRef,
}: {
  conversations: InboxConversation[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  channelTab: ChannelTab;
  isError: boolean; isFetching: boolean; onRetry: () => void;
  total: number; page: number; pages: number; onPageChange: (page: number) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <section aria-label="Lista de conversaciones" className="flex min-h-0 flex-1 flex-col bg-muted/20 md:bg-card">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p role="status" className="text-sm text-muted-foreground">{isLoading ? "Cargando conversaciones…" : isError ? "No se pudo actualizar la bandeja" : `${total} ${total === 1 ? "conversación" : "conversaciones"}`}</p>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto minimal-scrollbar">
        {isError && <div role="alert" className="space-y-3 p-4"><p className="text-sm">No se pudieron cargar las conversaciones. {conversations.length > 0 && "La lista anterior puede estar desactualizada."}</p><Button className="min-h-12" variant="secondary" onClick={onRetry} disabled={isFetching}>Reintentar conversaciones</Button></div>}
        {isLoading ? (
          <ConversationListSkeleton />
        ) : conversations.length === 0 && !isError ? (
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
      {pages > 1 && <nav aria-label="Páginas de conversaciones" className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-background p-3">
        <Button className="min-h-11" variant="secondary" disabled={page <= 1 || isLoading} onClick={() => onPageChange(page - 1)}>Anterior</Button>
        <span className="text-sm text-muted-foreground">{page} de {pages}</span>
        <Button className="min-h-11" variant="secondary" disabled={page >= pages || isLoading} onClick={() => onPageChange(page + 1)}>Siguiente</Button>
      </nav>}
    </section>
  );
}
