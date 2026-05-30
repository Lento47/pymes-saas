import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/shared/page-header";

export function SettingsLayout({ children }: { children: React.ReactNode }) {
  useAuth(); // keep auth context alive
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Configuración" />
      <main className="flex-1 overflow-y-auto p-6 min-w-0">
        {children}
      </main>
    </div>
  );
}
