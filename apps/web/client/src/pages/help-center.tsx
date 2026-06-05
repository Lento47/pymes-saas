import { useState } from "react";
import { Link } from "wouter";
import {
  BookOpen,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Phone,
  Search,
  Settings,
  Users,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// ── Data ─────────────────────────────────────────────────────────────────────

const GUIDES = [
  {
    id: "whatsapp-setup",
    icon: Phone,
    title: "Conectar WhatsApp Business",
    description: "Vincula tu número de WhatsApp Business en menos de 10 minutos.",
    steps: [
      "Ve a Configuración > Canales y haz clic en Agregar canal.",
      "Selecciona WhatsApp Business como proveedor.",
      "Ingresa tu número de teléfono registrado en Meta Business.",
      "Sigue el asistente de verificación de Meta (recibirás un SMS o llamada).",
      "Una vez verificado, tu bandeja de entrada empezará a recibir mensajes.",
    ],
    duration: "10 min",
  },
  {
    id: "invite-team",
    icon: Users,
    title: "Invitar a tu equipo",
    description: "Agrega agentes, define roles y asigna conversaciones.",
    steps: [
      "Ve a Configuración > Miembros.",
      "Haz clic en Invitar miembro e ingresa el correo del agente.",
      "Selecciona el rol: Agente (acceso al inbox), Admin (configuración), Propietario (todo).",
      "El agente recibirá un correo con el enlace de activación.",
      "Una vez activo, puedes asignar conversaciones desde el inbox.",
    ],
    duration: "5 min",
  },
  {
    id: "automations-basics",
    icon: Workflow,
    title: "Crear tu primera automatización",
    description: "Responde saludos automáticamente y clasifica conversaciones.",
    steps: [
      "Ve a Automatizaciones > Nueva regla.",
      "Selecciona el disparador: Mensaje recibido.",
      "Agrega la condición: el mensaje contiene 'hola' (o 'buenas', 'buen día').",
      "Define la acción: Enviar mensaje de respuesta.",
      "Escribe el texto de bienvenida y guarda la regla.",
    ],
    duration: "8 min",
  },
  {
    id: "ai-agent-setup",
    icon: Settings,
    title: "Configurar el agente IA",
    description: "Habilita respuestas automáticas con IA para tu negocio.",
    steps: [
      "Ve a Configuración > IA y habilita el asistente automático.",
      "Sube tu base de conocimiento (FAQs, catálogos, precios) en documentos de texto.",
      "Configura el mensaje de espera cuando un humano toma el control.",
      "Establece el horario de actividad del agente IA.",
      "Prueba el agente enviando un mensaje desde WhatsApp.",
    ],
    duration: "15 min",
  },
];

const FAQS = [
  {
    q: "¿Cuánto tiempo lleva conectar WhatsApp?",
    a: "El proceso de verificación con Meta toma entre 2 y 10 minutos. Solo necesitas acceso al número de teléfono registrado en tu cuenta de Meta Business.",
  },
  {
    q: "¿Puedo usar el mismo número de WhatsApp que ya tengo?",
    a: "Sí, siempre que el número esté registrado como número de WhatsApp Business en Meta Business Manager. Los números personales de WhatsApp requieren conversión previa.",
  },
  {
    q: "¿El agente IA puede enviar facturas automáticamente?",
    a: "No. El agente IA puede asistir en la conversación e informar sobre precios, pero la emisión de facturas electrónicas requiere confirmación manual de un agente para cumplir con la regulación de Hacienda CR.",
  },
  {
    q: "¿Qué pasa si el agente IA no sabe responder algo?",
    a: "La conversación se escala automáticamente al estado 'Requiere humano' y se notifica al equipo. El agente IA nunca inventa información — prefiere escalar si no tiene certeza.",
  },
  {
    q: "¿Mis datos de clientes están seguros?",
    a: "Sí. Todos los datos se almacenan en servidores con cifrado AES-256-GCM en reposo y TLS en tránsito. Cumplimos con la Ley 8968 de Protección de Datos Personales de Costa Rica.",
  },
  {
    q: "¿Cómo cancelo o cambio de plan?",
    a: "Ve a Configuración > Facturación y usa el selector de planes. Los cambios de plan muestran siempre una pantalla de confirmación con el monto a cobrar antes de ejecutarse.",
  },
  {
    q: "¿Puedo exportar mis datos?",
    a: "Sí. En Configuración > Workspace encontrarás la opción 'Exportar datos'. La exportación genera un archivo comprimido con tus contactos, conversaciones, tareas y documentos. Hay un límite de una exportación por cada 24 horas.",
  },
  {
    q: "¿Qué canales además de WhatsApp son compatibles?",
    a: "PymesHub también soporta Telegram y Email. Puedes agregar todos los canales desde Configuración > Canales.",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function HelpCenterPage() {
  const [search, setSearch] = useState("");
  const [openFaqs, setOpenFaqs] = useState<Set<number>>(new Set());

  const filteredFaqs = search.trim()
    ? FAQS.filter(
        (faq) =>
          faq.q.toLowerCase().includes(search.toLowerCase()) ||
          faq.a.toLowerCase().includes(search.toLowerCase()),
      )
    : FAQS;

  const filteredGuides = search.trim()
    ? GUIDES.filter(
        (g) =>
          g.title.toLowerCase().includes(search.toLowerCase()) ||
          g.description.toLowerCase().includes(search.toLowerCase()),
      )
    : GUIDES;

  const toggleFaq = (i: number) => {
    setOpenFaqs((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <BookOpen className="h-4 w-4" />
            <span>Centro de ayuda</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">
            ¿Cómo podemos ayudarte?
          </h1>
          <p className="text-sm text-muted-foreground mb-5">
            Guías paso a paso, respuestas frecuentes y acceso al soporte.
          </p>

          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en el centro de ayuda..."
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8 space-y-10">
        {/* Quick guides */}
        {filteredGuides.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-foreground">Guías de inicio</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredGuides.map((guide) => {
                const Icon = guide.icon;
                return (
                  <Collapsible key={guide.id}>
                    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                      <CollapsibleTrigger className="w-full text-left" asChild>
                        <button className="flex items-start justify-between gap-3 w-full">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{guide.title}</p>
                              <p className="text-xs text-muted-foreground">{guide.description}</p>
                            </div>
                          </div>
                          <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      </CollapsibleTrigger>

                      <CollapsibleContent className="space-y-2 pt-1">
                        <div className="text-xs text-muted-foreground mb-2">
                          Tiempo estimado: {guide.duration}
                        </div>
                        <ol className="space-y-2">
                          {guide.steps.map((step, i) => (
                            <li key={i} className="flex gap-2 text-sm text-foreground/80">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[11px] font-medium text-accent">
                                {i + 1}
                              </span>
                              <span className="leading-5">{step}</span>
                            </li>
                          ))}
                        </ol>
                        <div className="flex items-center gap-1.5 pt-2 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span>Completado en {guide.duration}</span>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          </section>
        )}

        {/* FAQ */}
        {filteredFaqs.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-foreground">Preguntas frecuentes</h2>
            <div className="divide-y divide-border rounded-lg border border-border bg-card">
              {filteredFaqs.map((faq, i) => (
                <div key={i} className="px-4">
                  <button
                    className="flex w-full items-center justify-between gap-4 py-4 text-left"
                    onClick={() => toggleFaq(i)}
                  >
                    <span className="text-sm font-medium text-foreground">{faq.q}</span>
                    {openFaqs.has(i) ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                  {openFaqs.has(i) && (
                    <p className="pb-4 text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {search.trim() && filteredGuides.length === 0 && filteredFaqs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">
              No se encontraron resultados para "{search}". Prueba con otras palabras o contacta a
              soporte.
            </p>
          </div>
        )}

        {/* Contact support CTA */}
        <section className="rounded-lg border border-border bg-card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">¿No encontraste lo que buscabas?</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Nuestro asistente IA puede ayudarte en tiempo real.
            </p>
          </div>
          <Link href="/support">
            <Button variant="outline" size="sm" className="gap-2 shrink-0">
              <MessageSquare className="h-4 w-4" />
              Hablar con soporte
            </Button>
          </Link>
        </section>
      </div>
    </div>
  );
}
