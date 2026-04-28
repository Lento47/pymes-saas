import { useState } from "react";
import { Link } from "wouter";
import { Check, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  key: string;
  label: string;
  link: string;
  done: boolean;
}

interface Props {
  progress: Record<string, boolean>;
  onDismiss: () => void;
}

const ITEMS: ChecklistItem[] = [
  { key: "contacts_added", label: "Agregar contactos de prueba", link: "/contacts", done: false },
  { key: "invoicing_configured", label: "Configurar facturación", link: "/invoices", done: false },
  { key: "whatsapp_connected", label: "Conectar WhatsApp", link: "/settings", done: false },
  { key: "email_connected", label: "Conectar email", link: "/settings", done: false },
  { key: "pipeline_created", label: "Crear pipeline de ventas", link: "/pipeline", done: false },
  { key: "hacienda_configured", label: "Configurar Hacienda (opcional)", link: "/settings", done: false },
  { key: "team_invited", label: "Invitar a tu equipo", link: "/settings", done: false },
];

export default function QuickStartChecklist({ progress, onDismiss }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const items = ITEMS.map((item) => ({
    ...item,
    done: !!progress[item.key],
  }));

  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length;

  if (allDone) return null;

  return (
    <div className="relative rounded-xl border border-[#5771ff]/20 bg-gradient-to-br from-[#5771ff]/[0.04] to-card/40 p-5 animate-in fade-in slide-in-from-top-4 duration-500">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-lg">🚀</span>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Configuración inicial</h3>
          <p className="text-xs text-muted-foreground">{doneCount} de {items.length} completados</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full bg-border/60 mb-3 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            doneCount >= 5 ? "bg-emerald-500" : "bg-[#5771ff]",
          )}
          style={{ width: `${(doneCount / items.length) * 100}%` }}
        />
      </div>

      {/* Items */}
      <div className="space-y-1">
        {items.map((item) => (
          <Link key={item.key} href={item.link}>
            <div
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors cursor-pointer group",
                item.done
                  ? "text-muted-foreground/60"
                  : "hover:bg-[#5771ff]/5 text-muted-foreground hover:text-foreground",
              )}
            >
              <div
                className={cn(
                  "w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0",
                  item.done ? "bg-emerald-500/20 text-emerald-500" : "border border-border text-transparent",
                )}
              >
                <Check className="w-3 h-3" />
              </div>
              <span className="text-xs flex-1 line-clamp-1">{item.label}</span>
              {!item.done && (
                <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
