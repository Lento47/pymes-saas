import { useState, useRef, useEffect } from 'react';
import { Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme, type Theme } from '@/components/providers/theme-provider';

const THEMES: { key: Theme; label: string; colors: string[] }[] = [
  { key: 'dark', label: 'Dark', colors: ['#18181a', '#1a73e8', '#ededed'] },
  { key: 'light', label: 'Light', colors: ['#f2f3f5', '#4b5ee7', '#22262b'] },
  { key: 'claude', label: 'Claude', colors: ['#faf6f0', '#d97706', '#292524'] },
  { key: 'chatgpt', label: 'ChatGPT', colors: ['#f7f7f8', '#10a37f', '#353740'] },
  { key: 'apple', label: 'Apple', colors: ['#f5f5f7', '#0071e3', '#1d1d1f'] },
  { key: 'samsung', label: 'Samsung', colors: ['#f7f7fc', '#5b4dda', '#1a1a2e'] },
];

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition hover:bg-foreground/5"
        style={{ color: 'hsl(var(--fg-2))' }}
        title="Tema"
      >
        <Palette className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{THEMES.find(t => t.key === theme)?.label}</span>
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-56 rounded-xl border bg-popover p-3 shadow-xl z-50"
          style={{ borderColor: 'hsl(var(--border))' }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Tema</p>
          <div className="grid grid-cols-3 gap-1.5">
            {THEMES.map(({ key, label, colors }) => (
              <button
                key={key}
                onClick={() => { setTheme(key); setOpen(false); }}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg p-2 transition hover:bg-foreground/5',
                  theme === key && 'ring-2 ring-offset-1',
                )}
                style={{
                  boxShadow: theme === key ? `0 0 0 2px ${colors[1]}` : undefined,
                }}
              >
                <div className="flex h-5 w-full overflow-hidden rounded-md">
                  {colors.map((c, i) => (
                    <span key={i} className="flex-1 h-full" style={{ background: c }} />
                  ))}
                </div>
                <span className="text-[9px] font-medium text-muted-foreground">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
