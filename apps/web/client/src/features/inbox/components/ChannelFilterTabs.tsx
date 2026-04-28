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
    <div className="flex w-fit items-center gap-1 rounded-full border border-border bg-foreground/[0.04] p-1">
      {CHANNEL_TABS.map(({ id, label, icon }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={cn(
              "flex h-8 items-center gap-2 rounded-full px-3 text-xs font-medium transition-all",
              isActive
                ? "bg-gradient-to-r from-primary to-brand-violet text-white "
                : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
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
