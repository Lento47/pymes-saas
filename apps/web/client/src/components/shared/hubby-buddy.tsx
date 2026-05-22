import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Bot } from 'lucide-react';

const ONBOARDING_KEY = 'PymesHub_onboarding_done';

export function HubbyBuddy() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onboardingDone = localStorage.getItem(ONBOARDING_KEY);
    if (!onboardingDone) return;

    const showTimer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(showTimer);
  }, []);

  return (
    <div
      className={`fixed bottom-6 right-6 z-30 transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
      style={{ pointerEvents: visible ? 'auto' : 'none' }}
    >
      <Link href="/agent">
        <div className="group flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted/35 hover:text-foreground">
          <Bot className="h-3.5 w-3.5" />
          <span>Asistente</span>
        </div>
      </Link>
    </div>
  );
}
