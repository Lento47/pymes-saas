import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/hooks/use-auth";
import { useInboxSocket } from "@/hooks/use-inbox-socket";
import { InboxHeader } from "./components/InboxHeader";
import { InboxToolbar } from "./components/InboxToolbar";
import { ConversationList } from "./components/ConversationList";
import { ConversationThreadPanel } from "./components/ConversationThreadPanel";
import { CustomerContextPanel } from "./components/CustomerContextPanel";
import { buildConversationQueryParams, normalizeConversationResponse } from "./utils";
import type { ChannelTab, ConversationStatusFilter } from "./types";

export default function InboxPage() {
  useRequireAuth();
  useInboxSocket();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ConversationStatusFilter>("ALL");
  const [channelTab, setChannelTab] = useState<ChannelTab>("ALL");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const params = buildConversationQueryParams({ search, statusFilter, channelTab });

  const conversationsQuery = useQuery({
    queryKey: ["conversations", params],
    queryFn: () => api.getConversations(Object.keys(params).length ? params : undefined),
  });

  const conversations = normalizeConversationResponse(conversationsQuery.data);

  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0].id);
    }
    if (selectedConversationId && !conversations.find((c) => c.id === selectedConversationId)) {
      setSelectedConversationId(conversations[0]?.id ?? null);
    }
  }, [conversations, selectedConversationId]);

  const selectedConversation =
    conversations.find((c) => c.id === selectedConversationId) ?? null;

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-50">
      <InboxHeader />

      <InboxToolbar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        channelTab={channelTab}
        onChannelTabChange={setChannelTab}
        onConversationCreated={setSelectedConversationId}
      />

      <div className="grid h-[calc(100vh-156px)] grid-cols-[340px_minmax(0,1fr)_340px] gap-3 overflow-hidden px-4 pb-4">
        <ConversationList
          conversations={conversations}
          isLoading={conversationsQuery.isLoading}
          selectedId={selectedConversationId}
          onSelect={setSelectedConversationId}
          channelTab={channelTab}
        />

        <ConversationThreadPanel conversationId={selectedConversationId} />

        <CustomerContextPanel conversation={selectedConversation} />
      </div>
    </div>
  );
}
