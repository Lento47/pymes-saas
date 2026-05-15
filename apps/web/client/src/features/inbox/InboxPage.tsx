import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth, useAuth } from "@/hooks/use-auth";
import { useInboxSocket } from "@/hooks/use-inbox-socket";
import { InboxHeader } from "./components/InboxHeader";
import { InboxToolbar } from "./components/InboxToolbar";
import { ConversationList } from "./components/ConversationList";
import { ConversationPanel } from "./components/ConversationPanel";
import { CustomerContextPanel } from "./components/CustomerContextPanel";
import { buildConversationQueryParams, normalizeConversationResponse } from "./utils";
import type { ChannelTab, ConversationStatusFilter } from "./types";
import { DiagnosticButton } from "@/components/shared/diagnostic-button";
import { HelpButton } from "@/components/shared/help-button";
import { InboxIcon } from "lucide-react";

export default function InboxPage() {
  useRequireAuth();
  useInboxSocket();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ConversationStatusFilter>("ALL");
  const [channelTab, setChannelTab] = useState<ChannelTab>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const params = buildConversationQueryParams({ search, statusFilter, channelTab, assignedUserId: user?.id });

  const conversationsQuery = useQuery({
    queryKey: ["conversations", params],
    queryFn: () => api.getConversations(Object.keys(params).length ? params : undefined),
  });

  const conversations = normalizeConversationResponse(conversationsQuery.data);
  const selectedConversation = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex flex-col h-full bg-background">
      <InboxHeader />

      <div className="px-4 sm:px-6 pb-2">
        <DiagnosticButton module="inbox" />
      </div>

      <InboxToolbar
        search={search}
        onSearchChange={setSearch}
        channelTab={channelTab}
        onChannelTabChange={setChannelTab}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {/* Desktop layout */}
      <div className="hidden md:grid flex-1 min-h-0 gap-px bg-border"
        style={{ gridTemplateColumns: "340px minmax(0,1fr) 300px" }}>
        <ConversationList
          conversations={conversations}
          isLoading={conversationsQuery.isLoading}
          selectedId={selectedId}
          onSelect={setSelectedId}
          channelTab={channelTab}
        />
        {selectedId ? (
          <ConversationPanel conversationId={selectedId} embedded />
        ) : (
          <section className="flex items-center justify-center bg-card">
            <div className="text-center px-8 max-w-[280px]">
              <InboxIcon className="mx-auto h-10 w-10 text-muted-foreground/25" />
              <p className="mt-3 text-sm text-muted-foreground/60">Seleccioná una conversación para ver los mensajes</p>
            </div>
          </section>
        )}
        <CustomerContextPanel conversation={selectedConversation} />
      </div>

      {/* Mobile: list or conversation detail */}
      <div className="md:hidden flex-1 min-h-0">
        {selectedId ? (
          <ConversationPanel
            conversationId={selectedId}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <ConversationList
            conversations={conversations}
            isLoading={conversationsQuery.isLoading}
            selectedId={selectedId}
            onSelect={setSelectedId}
            channelTab={channelTab}
          />
        )}
      </div>
      <HelpButton page="Bandeja" />
    </div>
  );
}
