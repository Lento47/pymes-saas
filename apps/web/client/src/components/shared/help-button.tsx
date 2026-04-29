import { LifeBuoy } from 'lucide-react';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';

interface HelpButtonProps {
  page: string;
  className?: string;
}

export function HelpButton({ page, className }: HelpButtonProps) {
  return (
    <Link
      href={`/agent?page=${encodeURIComponent(page)}`}
      className={cn(
        'fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl',
        className,
      )}
      style={{
        background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))',
        color: 'hsl(var(--primary-foreground))',
        boxShadow: '0 4px 24px hsl(var(--primary) / 0.3)',
      }}
      title={`Ayuda con ${page}`}
    >
      <LifeBuoy className="h-3.5 w-3.5" />
      Ayuda
    </Link>
  );
}
