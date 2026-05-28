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
        'fixed bottom-4 right-4 z-40 flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-gray-400 shadow-sm transition-colors hover:text-gray-600',
        className,
      )}
      title={`Ayuda con ${page}`}
    >
      <LifeBuoy className="h-4 w-4" />
    </Link>
  );
}
