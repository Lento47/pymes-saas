import { Search, SlidersHorizontal } from "lucide-react";
import { CHANNEL_TABS } from "../constants";
import { StatusFilterSelect } from "./StatusFilterSelect";
import { NewConversationModal } from "./NewConversationModal";
import type { ChannelTab, ConversationStatusFilter, InboxConversation } from "../types";

function countByStatus(conversations: InboxConversation[], statuses: string[]) {
  return conversations.filter((c) => statuses.includes(String(c.status).toUpperCase())).length;
}

function countByChannel(conversations: InboxConversation[], channel: string) {
  return conversations.filter((c) => String(c.channel?.type ?? "").toUpperCase() === channel).length;
}

function countUnassigned(conversations: InboxConversation[]) {
  return conversations.filter((c) => !c.assigned_user).length;
}

export function InboxToolbar({
  search,
  onSearchChange,
  channelTab,
  onChannelTabChange,
  statusFilter,
  onStatusFilterChange,
  conversations = [],
  isLoading,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  channelTab: ChannelTab;
  onChannelTabChange: (v: ChannelTab) => void;
  statusFilter: ConversationStatusFilter;
  onStatusFilterChange: (v: ConversationStatusFilter) => void;
  conversations?: InboxConversation[];
  isLoading?: boolean;
}) {
  const openCount = countByStatus(conversations, ["NEW", "OPEN", "IN_PROGRESS", "PENDING", "WAITING_CLIENT", "REQUIRES_HUMAN", "IA_ATTENDING", "BLOCKED"]);
  const needsHumanCount = countByStatus(conversations, ["REQUIRES_HUMAN"]);
  const invoiceLikeCount = conversations.filter((c) => {
    const meta = c.metadata_json ?? {};
    const subject = `${c.subject ?? ""} ${c.messages?.[c.messages.length - 1]?.body_text ?? ""}`.toLowerCase();
    return meta.intent === "INVOICE" || subject.includes("factura") || subject.includes("invoice");
  }).length;
  const whatsappCount = countByChannel(conversations, "WHATSAPP");
  const telegramCount = countByChannel(conversations, "TELEGRAM");
  const unassignedCount = countUnassigned(conversations);

  const mobileStatusChips: Array<{ label: string; value: ConversationStatusFilter; count?: number }> = [
    { label: "All", value: "ALL", count: conversations.length },
    { label: "Needs human", value: "REQUIRES_HUMAN", count: needsHumanCount },
    { label: "In progress", value: "IN_PROGRESS" },
    { label: "Waiting", value: "WAITING_CLIENT" },
    { label: "Resolved", value: "RESOLVED" },
  ];

  return (
    <div className="shrink-0 border-b border-border bg-background px-3 py-2.5 sm:px-4">
      <div className="flex items-start justify-between gap-3 md:hidden">
        <div className="min-w-0">
          <h1 className="text-[17px] font-semibold leading-tight text-foreground">Inbox</h1>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {isLoading ? "Loading conversations" : `${openCount} open · ${needsHumanCount} need human · ${invoiceLikeCount} invoice related`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            aria-label="Filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          <NewConversationModal />
        </div>
      </div>

      <div className="mt-2 md:mt-0 md:flex md:items-center md:justify-between md:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative w-full md:max-w-[260px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-muted-foreground/75" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search conversations..."
              className="h-9 w-full rounded-lg border border-border/50 bg-muted/30 pl-8 pr-3 text-[13px] text-foreground transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50 focus:bg-muted/50 focus:outline-none md:h-8 md:rounded-md"
            />
          </div>

          <div className="hidden items-center gap-1 md:flex">
            {CHANNEL_TABS.map((tab) => {
              const active = channelTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onChannelTabChange(tab.id)}
                  className={`flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-all duration-150 ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground/60 hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  <span className="scale-75">{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <StatusFilterSelect value={statusFilter} onChange={onStatusFilterChange} />
          <NewConversationModal />
        </div>
      </div>

      <div className="-mx-3 mt-2 flex gap-1 overflow-x-auto px-3 pb-0.5 minimal-scrollbar md:hidden">
        {mobileStatusChips.map((chip) => {
          const active = statusFilter === chip.value;
          const count = typeof chip.count === "number" ? chip.count : undefined;
          if (chip.value !== "ALL" && count === 0) return null;
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => onStatusFilterChange(chip.value)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "border-primary/20 bg-primary/10 text-primary"
                  : "border-border/60 bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              {chip.label}
              {typeof count === "number" && <span className="ml-1 text-[11px] opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="-mx-3 mt-1 flex gap-1 overflow-x-auto px-3 pb-0.5 minimal-scrollbar md:hidden">
        {[
          { label: "All channels", value: "ALL" as ChannelTab, count: conversations.length },
          { label: "WhatsApp", value: "WHATSAPP" as ChannelTab, count: whatsappCount },
          { label: "Telegram", value: "TELEGRAM" as ChannelTab, count: telegramCount },
          { label: "Unassigned", value: "UNASSIGNED" as ChannelTab, count: unassignedCount },
        ].map((chip) => {
          if (chip.value !== "ALL" && chip.count === 0) return null;
          const active = channelTab === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => onChannelTabChange(chip.value)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              {chip.label}
              <span className="ml-1 opacity-60">{chip.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
