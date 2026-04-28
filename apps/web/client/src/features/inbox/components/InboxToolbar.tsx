import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal } from "lucide-react";
import { ChannelFilterTabs } from "./ChannelFilterTabs";
import { StatusFilterSelect } from "./StatusFilterSelect";
import { NewConversationModal } from "./NewConversationModal";
import type { ChannelTab, ConversationStatusFilter } from "../types";

interface InboxToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: ConversationStatusFilter;
  onStatusFilterChange: (v: ConversationStatusFilter) => void;
  channelTab: ChannelTab;
  onChannelTabChange: (v: ChannelTab) => void;
  onConversationCreated?: (id: string) => void;
}

export function InboxToolbar(props: InboxToolbarProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  return (
    <div className="border-b border-border px-3 md:px-4 py-2 md:py-3">
      {/* Mobile: search + actions bar */}
      <div className="md:hidden space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              value={props.search}
              onChange={(e) => props.onSearchChange(e.target.value)}
              placeholder="Buscar..."
              className="h-9 rounded-control border-border bg-foreground/[0.04] pl-9 text-sm text-foreground placeholder:text-muted-foreground/70"
            />
          </div>
          <button
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            className="h-9 w-9 flex items-center justify-center rounded-control border border-border bg-foreground/[0.04] text-muted-foreground shrink-0"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          <NewConversationModal onCreated={props.onConversationCreated} />
        </div>
        {mobileFiltersOpen && (
          <div className="flex items-center gap-2">
            <div className="flex-1 overflow-x-auto scrollbar-none">
              <ChannelFilterTabs active={props.channelTab} onChange={props.onChannelTabChange} />
            </div>
            <StatusFilterSelect value={props.statusFilter} onChange={props.onStatusFilterChange} />
          </div>
        )}
      </div>

      {/* Desktop */}
      <div className="hidden md:flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              value={props.search}
              onChange={(e) => props.onSearchChange(e.target.value)}
              placeholder="Buscar conversaciones..."
              className="h-10 rounded-control border-border bg-foreground/[0.04] pl-9 text-sm text-foreground placeholder:text-muted-foreground/70"
            />
          </div>
          <ChannelFilterTabs active={props.channelTab} onChange={props.onChannelTabChange} />
        </div>
        <div className="flex items-center gap-2">
          <StatusFilterSelect value={props.statusFilter} onChange={props.onStatusFilterChange} />
          <NewConversationModal onCreated={props.onConversationCreated} />
        </div>
      </div>
    </div>
  );
}
