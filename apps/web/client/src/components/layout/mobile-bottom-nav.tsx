import { Link, useLocation } from "wouter";
import { LayoutDashboard, Inbox, Users, Receipt, Menu } from "lucide-react";

const TABS = [
  { path: "/", icon: LayoutDashboard, label: "Home" },
  { path: "/inbox", icon: Inbox, label: "Inbox" },
  { path: "/contacts", icon: Users, label: "Contacts" },
  { path: "/invoices", icon: Receipt, label: "Invoices" },
];

export function MobileBottomNav({ onMenuClick }: { onMenuClick: () => void }) {
  const [location] = useLocation();

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0D1424]/95 backdrop-blur-xl border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-14 px-2">
        {TABS.map(({ path, icon: Icon, label }) => {
          const active = path === "/" ? location === "/" : location.startsWith(path);
          return (
            <Link key={path} href={path}>
              <a className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg min-w-[56px] transition-colors ${
                active ? "text-brand-indigo" : "text-slate-400 hover:text-slate-200"
              }`}>
                <Icon className="w-5 h-5" strokeWidth={1.5} />
                <span className="text-[10px] font-medium">{label}</span>
              </a>
            </Link>
          );
        })}
        <button
          onClick={onMenuClick}
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg min-w-[56px] text-slate-400 hover:text-slate-200 transition-colors"
        >
          <Menu className="w-5 h-5" strokeWidth={1.5} />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>
    </nav>
  );
}
