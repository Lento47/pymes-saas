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
import { ArrowLeft, X } from "lucide-react";

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

  const selectedConversation =
    conversations.find((c) => c.id === selectedConversationId) ?? null;

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
    setMobileView("thread");
  };

  const content = (
    <>
      {/* Desktop: 3 columns | Tablet: 2 columns | Mobile: 1 column */}
      <div className="hidden lg:grid h-[calc(100dvh-156px)] grid-cols-[340px_minmax(0,1fr)_340px] gap-3 overflow-hidden px-4 pb-4">
        <ConversationList
          conversations={conversations}
          isLoading={conversationsQuery.isLoading}
          selectedId={selectedConversationId}
          onSelect={handleSelectConversation}
          channelTab={channelTab}
        />
        <ConversationThreadPanel conversationId={selectedConversationId} />
        <CustomerContextPanel conversation={selectedConversation} />
      </div>

      {/* Tablet: 2 columns (list + thread) */}
      <div className="hidden md:grid lg:hidden h-[calc(100dvh-156px)] grid-cols-[320px_1fr] gap-3 overflow-hidden px-4 pb-4">
        <ConversationList
          conversations={conversations}
          isLoading={conversationsQuery.isLoading}
          selectedId={selectedConversationId}
          onSelect={handleSelectConversation}
          channelTab={channelTab}
        />
        <ConversationThreadPanel conversationId={selectedConversationId} />
      </div>

      {/* Mobile: single column with view switching — subtract header (156px) + bottom nav (56px) */}
      <div className="md:hidden h-[calc(100dvh-212px)] overflow-hidden px-2 pb-2">
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
          <div className="flex flex-col h-full">
            <button
              onClick={() => setMobileView("list")}
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a la lista
            </button>
            <div className="flex-1 min-h-0">
              <ConversationThreadPanel conversationId={selectedConversationId} />
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background text-slate-50">
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
      {content}
    </div>
  );
}
