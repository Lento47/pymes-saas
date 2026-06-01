import { Search, SlidersHorizontal } from "lucide-react";
import { CHANNEL_TABS } from "../constants";
import { StatusFilterSelect } from "./StatusFilterSelect";
import { NewConversationModal } from "./NewConversationModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
      {/* ── Mobile header ── */}
      <div className="flex items-start justify-between gap-3 md:hidden">
        <div className="min-w-0">
          <h1 className="text-[17px] font-semibold leading-tight text-foreground">Inbox</h1>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {isLoading ? "Loading conversations" : `${openCount} open · ${needsHumanCount} need human · ${invoiceLikeCount} invoice related`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Filters">
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <NewConversationModal />
        </div>
      </div>

      {/* ── Desktop toolbar ── */}
      <div className="mt-2 md:mt-0 md:flex md:items-center md:justify-between md:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative w-full md:max-w-[260px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-muted-foreground/75" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search conversations..."
              className="h-9 w-full rounded-lg border-border/50 bg-muted/30 pl-8 pr-3 text-[13px] md:h-8 md:rounded-md"
            />
          </div>

          <div className="hidden items-center gap-1.5 md:flex">
            {CHANNEL_TABS.map((tab) => {
              const active = channelTab === tab.id;
              return (
                <Badge
                  key={tab.id}
                  variant={active ? "default" : "secondary"}
                  className={`cursor-pointer gap-1.5 px-2.5 py-0.5 text-[12px] font-medium transition-all ${
                    active
                      ? ""
                      : "text-muted-foreground/60 hover:text-foreground"
                  }`}
                  onClick={() => onChannelTabChange(tab.id)}
                >
                  <span className="scale-75">{tab.icon}</span>
                  {tab.label}
                </Badge>
              );
            })}
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <StatusFilterSelect value={statusFilter} onChange={onStatusFilterChange} />
          <NewConversationModal />
        </div>
      </div>

      {/* ── Mobile: status chips ── */}
      <div className="-mx-3 mt-2 flex gap-1 overflow-x-auto px-3 pb-0.5 minimal-scrollbar md:hidden">
        {mobileStatusChips.map((chip) => {
          const active = statusFilter === chip.value;
          const count = typeof chip.count === "number" ? chip.count : undefined;
          if (chip.value !== "ALL" && count === 0) return null;
          return (
            <Badge
              key={chip.value}
              variant={active ? "default" : "outline"}
              className="cursor-pointer shrink-0 gap-1 px-3 py-1.5 text-xs font-medium"
              onClick={() => onStatusFilterChange(chip.value)}
            >
              {chip.label}
              {typeof count === "number" && <span className="text-[11px] opacity-70">{count}</span>}
            </Badge>
          );
        })}
      </div>

      {/* ── Mobile: channel chips ── */}
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
            <Badge
              key={chip.value}
              variant={active ? "secondary" : "ghost"}
              className="cursor-pointer shrink-0 px-2.5 py-1 text-[11px] font-medium"
              onClick={() => onChannelTabChange(chip.value)}
            >
              {chip.label}
              <span className="ml-1 opacity-60">{chip.count}</span>
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
