import { Search } from "lucide-react";
import { CHANNEL_TABS } from "../constants";
import { StatusFilterSelect } from "./StatusFilterSelect";
import { NewConversationModal } from "./NewConversationModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/arc/button/button";
import type { ChannelTab, ConversationStatusFilter } from "../types";

export function InboxToolbar({ search, onSearchChange, onSearch, channelTab, onChannelTabChange,
  statusFilter, onStatusFilterChange, canCreate, onCreated }: {
  search: string; onSearchChange: (value: string) => void; onSearch: () => void;
  channelTab: ChannelTab; onChannelTabChange: (value: ChannelTab) => void;
  statusFilter: ConversationStatusFilter; onStatusFilterChange: (value: ConversationStatusFilter) => void;
  canCreate: boolean; onCreated: (id: string) => void;
}) {
  const quickFilters: { value: ConversationStatusFilter; label: string }[] = [
    { value: "ALL", label: "Todas" }, { value: "REQUIRES_HUMAN", label: "Requieren atención" },
    { value: "WAITING_CLIENT", label: "Esperando cliente" }, { value: "RESOLVED", label: "Resueltas" },
  ];
  return <header className="shrink-0 space-y-3 border-b bg-background px-4 pb-3 pt-4">
    <div className="flex items-center justify-between gap-3"><h1 className="text-[28px] font-semibold tracking-tight">Bandeja</h1>{canCreate && <NewConversationModal onCreated={onCreated} />}</div>
    <form className="flex gap-2" role="search" onSubmit={event => { event.preventDefault(); onSearch(); }}>
      <Input aria-label="Buscar asunto o cliente" type="search" className="h-12 min-w-0 flex-1 rounded-xl bg-muted/30 text-base" placeholder="Buscar asunto o cliente" value={search} onChange={event => onSearchChange(event.target.value)} />
      <Button type="submit" variant="secondary" className="h-12 w-12 shrink-0 rounded-xl p-0" aria-label="Buscar conversaciones"><Search aria-hidden className="h-5 w-5" /></Button>
    </form>
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Estados frecuentes">
      {quickFilters.map(filter => <Button key={filter.value} type="button" variant={statusFilter === filter.value ? "primary" : "secondary"} aria-pressed={statusFilter === filter.value} className="min-h-11 shrink-0 rounded-full px-4 text-sm" onClick={() => onStatusFilterChange(filter.value)}>{filter.label}</Button>)}
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div className="min-w-0"><label htmlFor="inbox-channel" className="sr-only">Canal o asignación</label><select id="inbox-channel" className="h-12 w-full rounded-xl border bg-background px-2 text-sm" value={channelTab} onChange={event => onChannelTabChange(event.target.value as ChannelTab)}>{CHANNEL_TABS.map(tab => <option key={tab.id} value={tab.id}>{tab.label}</option>)}</select></div>
      <StatusFilterSelect value={statusFilter} onChange={onStatusFilterChange} />
    </div>
  </header>;
}
