import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/shared/page-header";
import { Building2, Users, PlugZap, Layers, Plug, BrainCircuit, ShieldCheck } from "lucide-react";

const SETTINGS_NAV = [
  { path: "/settings/workspace",    label: "Workspace",               icon: Building2 },
  { path: "/settings/members",      label: "Miembros",                icon: Users },
  { path: "/settings/channels",     label: "Canales",                 icon: PlugZap },
  { path: "/settings/departments",  label: "Departamentos",           icon: Layers },
  { path: "/settings/integrations", label: "Integraciones",           icon: Plug },
  { path: "/settings/ai",           label: "Inteligencia Artificial", icon: BrainCircuit },
] as const;

const PLATFORM_ITEM = { path: "/settings/platform", label: "Plataforma", icon: ShieldCheck } as const;

export function SettingsLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const isPlatformAdmin = user?.is_platform_admin === true;
  const navItems = isPlatformAdmin ? [...SETTINGS_NAV, PLATFORM_ITEM] : [...SETTINGS_NAV];

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Configuración" />
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        <nav className="shrink-0 border-b border-border md:border-b-0 md:border-r md:w-52 overflow-x-auto md:overflow-y-auto py-3 px-2 flex flex-row md:flex-col gap-1 md:space-y-0.5">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location === path || location.startsWith(path + "/");
            return (
              <Link key={path} href={path}>
                <div
                  className={cn(
                    "relative flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors whitespace-nowrap",
                    active
                      ? "bg-primary/10 text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/35"
                  )}
                >
                  {active && (
                    <div className="hidden md:block absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                  )}
                  <Icon
                    className={cn("w-4 h-4 shrink-0", active ? "text-primary" : "")}
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                  <span>{label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 overflow-y-auto p-6 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
