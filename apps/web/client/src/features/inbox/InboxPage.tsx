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
import { DiagnosticButton } from "@/components/shared/diagnostic-button";
import { HelpButton } from "@/components/shared/help-button";

type MobileView = "list" | "thread" | "context";

export default function InboxPage() {
  useRequireAuth();
  useInboxSocket();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ConversationStatusFilter>("ALL");
  const [channelTab, setChannelTab] = useState<ChannelTab>("ALL");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("list");

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

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId) ?? null;

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
    setMobileView("thread");
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header: title + subtitle */}
      <InboxHeader />

      <div className="px-6 pb-2">
        <DiagnosticButton module="inbox" />
      </div>

      {/* Toolbar: search + filters + new button */}
      <InboxToolbar
        search={search}
        onSearchChange={setSearch}
        channelTab={channelTab}
        onChannelTabChange={setChannelTab}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {/* Desktop: 3-panel layout */}
      <div className="hidden lg:grid flex-1 min-h-0 grid-cols-[340px_minmax(0,1fr)_300px] gap-px bg-border">
        <ConversationList
          conversations={conversations}
          isLoading={conversationsQuery.isLoading}
          selectedId={selectedConversationId}
          onSelect={handleSelectConversation}
          channelTab={channelTab}
        />
        <ConversationThreadPanel conversationId={selectedConversationId} conversation={selectedConversation} />
        <CustomerContextPanel conversation={selectedConversation} />
      </div>

      {/* Tablet: 2 columns */}
      <div className="hidden md:grid lg:hidden flex-1 min-h-0 grid-cols-[320px_1fr] gap-px bg-border">
        <ConversationList
          conversations={conversations}
          isLoading={conversationsQuery.isLoading}
          selectedId={selectedConversationId}
          onSelect={handleSelectConversation}
          channelTab={channelTab}
        />
        <ConversationThreadPanel conversationId={selectedConversationId} conversation={selectedConversation} />
      </div>

      {/* Mobile: single column */}
      <div className="md:hidden flex-1 min-h-0">
        {mobileView === "list" && (
          <ConversationList
            conversations={conversations}
            isLoading={conversationsQuery.isLoading}
            selectedId={selectedConversationId}
            onSelect={handleSelectConversation}
            channelTab={channelTab}
          />
        )}
        {mobileView === "thread" && (
          <ConversationThreadPanel conversationId={selectedConversationId} conversation={selectedConversation} />
        )}
      </div>
      <HelpButton page="Bandeja" />
    </div>
  );
}
