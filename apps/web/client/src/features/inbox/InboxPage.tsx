import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth, useAuth } from "@/hooks/use-auth";
import { useInboxSocket } from "@/hooks/use-inbox-socket";
import { useRoute, useLocation, useSearch } from "wouter";
import { InboxToolbar } from "./components/InboxToolbar";
import { ConversationList } from "./components/ConversationList";
import { ConversationPanel } from "./components/ConversationPanel";
import { CustomerContextPanel } from "./components/CustomerContextPanel";
import { ContactFromConversationDialog } from "./components/ContactFromConversationDialog";
import { buildConversationQueryParams, normalizeConversationResponse } from "./utils";
import { STATUS_OPTIONS, type ChannelTab, type ConversationStatusFilter } from "./types";
import { CHANNEL_TABS } from "./constants";
import { hasPermission, Permission } from "@/lib/permissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { InboxIcon } from "lucide-react";
import { HelpButton } from "@/components/shared/help-button";

export default function InboxPage() {
  useRequireAuth();
  const { user } = useAuth();
  if (!hasPermission(user?.role ?? "", Permission.CONVERSATIONS_READ, !!user?.is_platform_admin)) {
    return <div className="p-6"><h1 className="text-2xl font-semibold">Bandeja</h1><p className="mt-3">Tu rol no tiene acceso a conversaciones.</p></div>;
  }
  return <InboxWorkspace key={user!.workspace.id} />;
}

function InboxWorkspace() {
  useInboxSocket();
  const { user } = useAuth();
  const mobile = useIsMobile();
  const [, route] = useRoute("/inbox/:id");
  const [, navigate] = useLocation();
  const selectedId = route?.id ?? null;
  const params = new URLSearchParams(useSearch());
  const query = params.get("q") ?? "";
  const statusFilter = STATUS_OPTIONS.includes(params.get("status") as ConversationStatusFilter) ? params.get("status") as ConversationStatusFilter : "ALL";
  const channelTab = CHANNEL_TABS.some(tab => tab.id === params.get("channel")) ? params.get("channel") as ChannelTab : "ALL";
  const requestedPage = Number(params.get("page"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [search, setSearch] = useState(query);
  const [showAddContact, setShowAddContact] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => setSearch(query), [query]);
  useEffect(() => { listRef.current?.scrollTo({ top: 0 }); }, [page, query, statusFilter, channelTab]);
  const can = (permission: Permission) => hasPermission(user?.role ?? "", permission, !!user?.is_platform_admin);
  const suffix = params.size ? `?${params.toString()}` : "";
  const openConversation = (id: string) => navigate(`/inbox/${id}${suffix}`);
  const changeFilters = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params); next.delete("page");
    for (const [key, value] of Object.entries(changes)) { if (value && value !== "ALL") next.set(key, value); else next.delete(key); }
    navigate(`/inbox${next.size ? `?${next.toString()}` : ""}`);
  };
  const queryParams = { ...buildConversationQueryParams({ search: query, statusFilter, channelTab, assignedUserId: user?.id }), page: String(page), limit: "20" };
  const conversationsQuery = useQuery({
    queryKey: ["conversations", user?.workspace.id, queryParams],
    queryFn: () => api.getConversations(queryParams),
    refetchInterval: 5_000,
    retry: false,
  });
  const conversations = normalizeConversationResponse(conversationsQuery.data);
  const total = conversationsQuery.data?.meta?.total ?? conversations.length;
  const pages = Math.max(1, conversationsQuery.data?.meta?.pages ?? 1);
  const selectedConversation = conversations.find(c => c.id === selectedId) ?? null;

  return <div className="inbox-page flex h-full min-h-0 flex-col bg-background">
    <div className={selectedId ? "hidden md:block" : ""}>
      <InboxToolbar search={search} onSearchChange={setSearch} onSearch={() => changeFilters({ q: search.trim() })}
        channelTab={channelTab} onChannelTabChange={channel => changeFilters({ channel })}
        statusFilter={statusFilter} onStatusFilterChange={status => changeFilters({ status })}
        canCreate={can(Permission.CONVERSATIONS_REPLY)} onCreated={openConversation} />
    </div>
    <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(260px,35%)_minmax(0,1fr)] xl:grid-cols-[minmax(280px,30%)_minmax(0,1fr)_280px]">
      <div className={`${selectedId ? "hidden md:flex" : "flex"} min-h-0 min-w-0 flex-col md:border-r`}>
        <ConversationList conversations={conversations} isLoading={conversationsQuery.isLoading}
          isError={conversationsQuery.isError} isFetching={conversationsQuery.isFetching} onRetry={() => conversationsQuery.refetch()}
          selectedId={selectedId} onSelect={openConversation} channelTab={channelTab} total={total} page={page} pages={pages}
          onPageChange={next => changeFilters({ page: String(next) })} scrollRef={listRef} />
      </div>
      <div className={`${selectedId ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-col`}>
        {selectedId ? <ConversationPanel key={selectedId} conversationId={selectedId} embedded={!mobile} onBack={() => navigate(`/inbox${suffix}`)} />
          : <section className="flex flex-1 items-center justify-center bg-card p-8 text-center"><div><InboxIcon aria-hidden className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">Selecciona una conversación para ver los mensajes.</p></div></section>}
      </div>
      {!mobile && <div className="hidden min-h-0 overflow-y-auto xl:block"><CustomerContextPanel conversation={selectedConversation} onAddContact={selectedId && can(Permission.CONTACTS_MANAGE) ? () => setShowAddContact(true) : undefined} /></div>}
    </div>
    {selectedId && showAddContact && <ContactFromConversationDialog open onOpenChange={setShowAddContact} conversationId={selectedId} conversation={selectedConversation} />}
    <HelpButton page="Bandeja" />
  </div>;
}
