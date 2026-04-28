import { cn } from "@/lib/utils";
import type { ChannelTab } from "../types";
import { CHANNEL_TABS } from "../constants";

export function ChannelFilterTabs({
  active,
  onChange,
}: {
  active: ChannelTab;
  onChange: (tab: ChannelTab) => void;
}) {
  return (
    <div className="flex w-fit items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
      {CHANNEL_TABS.map(({ id, label, icon }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={cn(
              "flex h-8 items-center gap-2 rounded-full px-3 text-xs font-medium transition-all",
              isActive
                ? "bg-gradient-to-r from-brand-indigo to-brand-violet text-white shadow-glow"
                : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
            )}
          >
            {icon}
            {label}
          </button>
        );
      })}
    </div>
  );
}
