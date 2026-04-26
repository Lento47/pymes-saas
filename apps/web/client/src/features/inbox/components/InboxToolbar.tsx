import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
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
  return (
    <div className="border-b border-white/10 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={props.search}
              onChange={(e) => props.onSearchChange(e.target.value)}
              placeholder="Buscar conversaciones..."
              className="h-10 rounded-control border-white/10 bg-white/[0.04] pl-9 text-sm text-slate-100 placeholder:text-slate-500"
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
