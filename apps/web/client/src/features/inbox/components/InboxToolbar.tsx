import { Search } from "lucide-react";
import { CHANNEL_TABS } from "../constants";
import { StatusFilterSelect } from "./StatusFilterSelect";
import { NewConversationModal } from "./NewConversationModal";
import type { ChannelTab, ConversationStatusFilter } from "../types";

export function InboxToolbar({
  search,
  onSearchChange,
  channelTab,
  onChannelTabChange,
  statusFilter,
  onStatusFilterChange,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  channelTab: ChannelTab;
  onChannelTabChange: (v: ChannelTab) => void;
  statusFilter: ConversationStatusFilter;
  onStatusFilterChange: (v: ConversationStatusFilter) => void;
}) {
  return (
    <div className="shrink-0 border-b border-border px-3 sm:px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        {/* Left: search + filters */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative w-full max-w-[260px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-muted-foreground/75" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar conversaciones..."
              className="w-full h-8 pl-8 pr-3 rounded-md border-0 border-b border-border/60 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/75 focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>

          {/* Channel filter pills */}
          <div className="hidden md:flex items-center gap-1">
            {CHANNEL_TABS.map((tab) => {
              const active = channelTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onChannelTabChange(tab.id)}
                  className={`flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-all duration-150 ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <span className="scale-75">{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: status + new */}
        <div className="flex items-center gap-2 shrink-0">
          <StatusFilterSelect value={statusFilter} onChange={onStatusFilterChange} />
          <NewConversationModal />
        </div>
      </div>
    </div>
  );
}
