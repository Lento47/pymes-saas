import { LogOut } from "lucide-react";

export function SidebarMobileLogoutFallback({
  label = "Logout",
  onLogout,
}: {
  label?: string;
  onLogout: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onLogout}
      className="flex h-10 items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/15 hover:text-destructive"
      aria-label={label}
      title={label}
    >
      <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      <span>{label}</span>
    </button>
  );
}
