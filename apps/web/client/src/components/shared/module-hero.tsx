import { type ModuleKey } from "@/lib/moduleHeroTheme";

interface ModuleHeroProps {
  module: ModuleKey;
  children?: React.ReactNode;
  className?: string;
}

export function ModuleHero({ children, className = "" }: ModuleHeroProps) {
  return (
    <section className={`relative w-full overflow-hidden rounded-lg border border-border bg-card ${className}`}>
      <div className="relative z-10">{children}</div>
    </section>
  );
}
