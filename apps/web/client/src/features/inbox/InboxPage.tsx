import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth, useAuth } from "@/hooks/use-auth";
import { useInboxSocket } from "@/hooks/use-inbox-socket";
import { useRoute, useLocation } from "wouter";
import { InboxToolbar } from "./components/InboxToolbar";
import { ConversationList } from "./components/ConversationList";
import { ConversationPanel } from "./components/ConversationPanel";
import { CustomerContextPanel } from "./components/CustomerContextPanel";
import { ContactFromConversationDialog } from "./components/ContactFromConversationDialog";
import { buildConversationQueryParams, normalizeConversationResponse } from "./utils";
import type { ChannelTab, ConversationStatusFilter } from "./types";
import { HelpButton } from "@/components/shared/help-button";
import { InboxIcon } from "lucide-react";

export default function InboxPage() {
  useRequireAuth();
  useInboxSocket();
  const { user } = useAuth();

  // URL-based conversation selection — supports direct navigation to /inbox/:id
  const [, params] = useRoute("/inbox/:id");
  const [, navigate] = useLocation();
  const selectedId = params?.id ?? null;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ConversationStatusFilter>("ALL");
  const [channelTab, setChannelTab] = useState<ChannelTab>("ALL");
  const [showAddContact, setShowAddContact] = useState(false);

  const queryParams = buildConversationQueryParams({ search, statusFilter, channelTab, assignedUserId: user?.id });

  const conversationsQuery = useQuery({
    queryKey: ["conversations", queryParams],
    queryFn: () => api.getConversations(Object.keys(queryParams).length ? queryParams : undefined),
  });

  const conversations = normalizeConversationResponse(conversationsQuery.data);
  const selectedConversation = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex flex-col h-full bg-background">
      <InboxToolbar
        search={search}
        onSearchChange={setSearch}
        channelTab={channelTab}
        onChannelTabChange={setChannelTab}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {/* Desktop layout */}
      <div className="hidden md:grid flex-1 min-h-0 divide-x divide-border"
        style={{ gridTemplateColumns: "380px minmax(0,1fr) 320px" }}>
        <ConversationList
          conversations={conversations}
          isLoading={conversationsQuery.isLoading}
          selectedId={selectedId}
          onSelect={(id) => navigate(`/inbox/${id}`)}
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
        <CustomerContextPanel
          conversation={selectedConversation}
          onAddContact={selectedId ? () => setShowAddContact(true) : undefined}
        />
      </div>

      {/* Mobile: list or conversation detail */}
      <div className="md:hidden flex-1 min-h-0">
        {selectedId ? (
          <ConversationPanel
            conversationId={selectedId}
            onBack={() => navigate("/inbox")}
          />
        ) : (
          <ConversationList
            conversations={conversations}
            isLoading={conversationsQuery.isLoading}
            selectedId={selectedId}
            onSelect={(id) => navigate(`/inbox/${id}`)}
            channelTab={channelTab}
          />
        )}
      </div>
      {selectedId && (
        <ContactFromConversationDialog
          open={showAddContact}
          onOpenChange={setShowAddContact}
          conversationId={selectedId}
          conversation={selectedConversation}
        />
      )}
      <HelpButton page="Bandeja" />
    </div>
  );
}
