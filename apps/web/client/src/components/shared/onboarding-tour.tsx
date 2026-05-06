import { useState, useEffect } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TourStep {
  target: string;
  title: string;
  description: string;
  position: "bottom" | "top" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "#sidebar-dashboard",
    title: "Dashboard",
    description: "Aquí ves tus métricas en tiempo real: ingresos, facturas pendientes, conversaciones activas, pipeline de ventas y tareas del equipo.",
    position: "right",
  },
  {
    target: "#sidebar-inbox",
    title: "Inbox Unificado",
    description: "Todos tus mensajes de WhatsApp, email, Telegram y formularios en un solo lugar. Asigna conversaciones, responde y haz seguimiento.",
    position: "right",
  },
  {
    target: "#sidebar-contacts",
    title: "Clientes y Contactos",
    description: "Gestiona tus clientes, leads y proveedores. Importa contactos desde CSV o créalos manualmente. Todo tu CRM aquí.",
    position: "right",
  },
  {
    target: "#sidebar-invoices",
    title: "Facturación Electrónica",
    description: "Crea facturas electrónicas listas para Hacienda. Gestiona cobros, recordatorios de pago y ve tus ingresos en tiempo real.",
    position: "right",
  },
  {
    target: "#sidebar-pipeline",
    title: "Pipeline de Ventas",
    description: "Organiza tus oportunidades por etapa (Prospección → Propuesta → Negociación → Cerrado). Arrastra deals entre etapas.",
    position: "right",
  },
  {
    target: "#sidebar-automations",
    title: "Automatizaciones",
    description: "Reglas pre-configuradas que trabajan por ti: asigna conversaciones, etiqueta mensajes, notifica a tu equipo automáticamente.",
    position: "right",
  },
];

const STORAGE_KEY = "pymeshub_onboarding_tour_done_v2";

export default function OnboardingTour() {
  const { messages } = useI18n();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if tour was already completed
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      // Delay start to let dashboard render
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!visible || step >= TOUR_STEPS.length) return null;

  const current = TOUR_STEPS[step];

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  const next = () => {
    if (step + 1 >= TOUR_STEPS.length) {
      finish();
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 pointer-events-auto" onClick={finish} />

      {/* Speech bubble positioned in center */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
        <div
          className={cn(
            "relative max-w-md w-full mx-4",
            "rounded-2xl border border-primary/30",
            "bg-card/95 backdrop-blur-xl shadow-2xl",
            "animate-in fade-in zoom-in-95 duration-300",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center text-sm font-bold text-primary-foreground">
                {step + 1}
              </div>
              <span className="text-xs text-foreground/60">
                Paso {step + 1} de {TOUR_STEPS.length}
              </span>
            </div>
            <button
              onClick={finish}
              className="text-foreground/40 hover:text-foreground/80 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            <h3 className="text-lg font-semibold text-foreground mb-2">{current.title}</h3>
            <p className="text-sm text-foreground/70 leading-relaxed">{current.description}</p>
          </div>

          {/* Footer */}
          <div className="px-6 pb-5 flex items-center justify-between">
            {/* Progress dots */}
            <div className="flex gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-colors",
                    i <= step ? "bg-primary" : "bg-muted",
                  )}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={finish}
                className="text-xs text-foreground/50 hover:text-foreground/80 transition-colors px-2 py-1"
              >
                Saltar
              </button>
              <button
                onClick={next}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/80 transition-colors"
              >
                {step + 1 >= TOUR_STEPS.length ? "¡Listo!" : "Siguiente"}
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
