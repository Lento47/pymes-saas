import { Clock, FileText } from "lucide-react";

interface ServiceWindowGuardProps {
  isWindowOpen: boolean;
  isWhatsApp: boolean;
  onSelectTemplate: () => void;
}

/**
 * When the WhatsApp customer service window is closed,
 * replace the free-form composer with a template-required UI.
 */
export function ServiceWindowGuard({
  isWindowOpen,
  isWhatsApp,
  onSelectTemplate,
}: ServiceWindowGuardProps) {
  if (!isWhatsApp || isWindowOpen) return null;

  return (
    <div className="shrink-0 border-t border-border bg-amber-500/[0.04] px-4 py-3">
      <div className="flex items-start gap-2.5">
        <Clock className="w-4 h-4 text-amber-400/70 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-amber-400/90">
            Ventana de servicio cerrada
          </p>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5 leading-relaxed">
            Para enviar mensajes fuera de la ventana de 24h, necesitás usar una
            plantilla aprobada de WhatsApp.
          </p>
          <button
            type="button"
            onClick={onSelectTemplate}
            className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors bg-primary/[0.06] hover:bg-primary/[0.10] rounded-md px-2.5 py-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            Elegir plantilla
          </button>
        </div>
      </div>
    </div>
  );
}
