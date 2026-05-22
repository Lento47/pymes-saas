import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    setOffline(!navigator.onLine);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 text-white text-xs text-center py-2 px-4 font-medium flex items-center justify-center gap-2 safe-area-bottom" style={{ background: "rgba(124,58,237,0.92)", borderTop: "1px solid rgba(167,139,250,0.3)" }}>
      <WifiOff className="h-3.5 w-3.5" />
      Sin conexión — los cambios se sincronizarán al reconectar.
    </div>
  );
}
