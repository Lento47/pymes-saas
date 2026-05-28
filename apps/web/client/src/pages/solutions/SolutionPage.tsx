import { motion } from "framer-motion";
import { Link, Redirect } from "wouter";
import {
  ArrowRight, CheckCircle2, Inbox, Users, Bot, FileText,
  Calendar, Zap, BarChart2, ShoppingBag, Globe, Repeat,
  MessageCircle, AlertCircle, Clock, TrendingUp,
} from "lucide-react";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { Footer } from "@/components/marketing/footer";

const ACCENT = "#6757E8";
const BG = "#F7F8FC";
const BORDER = "#E6E8EF";

interface SolutionConfig {
  eyebrow: string;
  headline: string;
  subtext: string;
  pains: Array<{ icon: React.ElementType; title: string; text: string }>;
  features: Array<{ icon: React.ElementType; title: string; text: string }>;
  quote: string;
  quoteAuthor: string;
  ctaHeadline: string;
}

const SOLUTIONS: Record<string, SolutionConfig> = {
  "small-teams": {
    eyebrow: "Para equipos pequeños",
    headline: "Un sistema operativo para tu equipo",
    subtext:
      "Unificá WhatsApp, email y tareas en un solo lugar. Dejá de perder el tiempo buscando conversaciones y empezá a cerrar más ventas.",
    pains: [
      { icon: AlertCircle, title: "Sin visibilidad del equipo", text: "Nadie sabe quién está atendiendo qué. Los clientes caen entre las grietas." },
      { icon: MessageCircle, title: "Conversaciones perdidas", text: "Mensajes en teléfonos personales, sin historial ni contexto compartido." },
      { icon: Clock, title: "Seguimientos olvidados", text: "El cliente esperó, nadie le escribió de vuelta. La venta se enfrió." },
    ],
    features: [
      { icon: Inbox, title: "Bandeja omnicanal", text: "WhatsApp, email y web chat en una sola pantalla compartida por todo el equipo." },
      { icon: Users, title: "Asignación de conversaciones", text: "Asigná cada consulta a la persona correcta en segundos, con contexto completo." },
      { icon: Bot, title: "Agente IA incluido", text: "Respondé automáticamente fuera de horario y cualificá leads antes de que lleguen al equipo." },
      { icon: FileText, title: "CRM integrado", text: "Ficha de cliente, historial de conversaciones y deals en un solo lugar." },
    ],
    quote:
      "Antes perdíamos ventas porque nadie sabía quién había atendido qué. Ahora todo el equipo ve el mismo inbox y los clientes sienten la diferencia.",
    quoteAuthor: "Equipo de ventas, empresa de servicios B2B",
    ctaHeadline: "Tu equipo merece mejores herramientas",
  },

  retail: {
    eyebrow: "Para retail",
    headline: "Atiende más, pierde menos ventas",
    subtext:
      "Gestioná consultas, pedidos y cobros desde la misma pantalla. Menos tabs abiertos, más ventas cerradas.",
    pains: [
      { icon: MessageCircle, title: "Consultas sin responder", text: "El cliente pregunta por WhatsApp y nadie le contesta a tiempo. La competencia lo atiende primero." },
      { icon: AlertCircle, title: "Pedidos sin seguimiento", text: "Órdenes que se pierden, entregas que nadie confirmó, clientes que reclaman." },
      { icon: Clock, title: "Sin historial del cliente", text: "Cada vez que escribe es como si fuera la primera vez. Cero personalización." },
    ],
    features: [
      { icon: Inbox, title: "Inbox unificado", text: "Todas las consultas de WhatsApp, Instagram y email en una sola bandeja de entrada." },
      { icon: FileText, title: "Factura desde la conversación", text: "Creá y enviá facturas o cotizaciones directamente desde el chat, sin cambiar de app." },
      { icon: Bot, title: "Bot de estado de pedido", text: "El agente IA responde al instante sobre estados de entrega, disponibilidad y precios." },
      { icon: TrendingUp, title: "Historial de compras", text: "Cada cliente llega con su historial: pedidos anteriores, valor total, preferencias." },
    ],
    quote:
      "Antes tardábamos horas en responder consultas de WhatsApp. Hoy el agente responde en segundos y nosotros solo revisamos lo que necesita atención humana.",
    quoteAuthor: "Dueño, tienda de ropa online · Costa Rica",
    ctaHeadline: "Más ventas, el mismo equipo",
  },

  services: {
    eyebrow: "Para empresas de servicios",
    headline: "Más clientes recurrentes, menos administración",
    subtext:
      "Agendá, cotizá y hacé seguimiento de cada cliente desde un solo lugar. Que la administración no te quite tiempo de servicio.",
    pains: [
      { icon: Calendar, title: "Citas sin confirmar", text: "El cliente agendó, nadie le confirmó, y al final no aparece. Hora perdida." },
      { icon: FileText, title: "Cotizaciones sin respuesta", text: "Enviaste la propuesta y nunca sabes si la leyeron o si ya eligieron a otro." },
      { icon: Users, title: "Clientes que no vuelven", text: "Terminás el servicio y el cliente desaparece. Sin seguimiento no hay retención." },
    ],
    features: [
      { icon: Calendar, title: "Gestión de citas", text: "Agenda integrada con confirmación automática por WhatsApp y recordatorios previos." },
      { icon: FileText, title: "Plantillas de cotización", text: "Enviá propuestas profesionales en segundos directamente desde la conversación." },
      { icon: Zap, title: "Automatizaciones de seguimiento", text: "Recordatorios de pago, encuestas post-servicio y re-activación de clientes inactivos." },
      { icon: Users, title: "Ficha de cliente", text: "Historial completo: servicios contratados, pagos, notas y próximos vencimientos." },
    ],
    quote:
      "PymesHub me ayudó a reducir el no-show a la mitad. Los recordatorios automáticos hacen el trabajo que antes me tomaba horas cada semana.",
    quoteAuthor: "Terapeuta independiente · San José",
    ctaHeadline: "Enfocate en el servicio, no en la administración",
  },

  agencies: {
    eyebrow: "Para agencias",
    headline: "Todos tus clientes, un solo panel",
    subtext:
      "Manejá múltiples clientes, equipos y canales sin perder el contexto. Más proyectos, la misma energía.",
    pains: [
      { icon: Repeat, title: "Cambio de contexto constante", text: "Diez clientes, diez WhatsApp, diez grupos. No hay manera de ver el panorama completo." },
      { icon: BarChart2, title: "Sin reportes por cliente", text: "¿Cuánto tiempo le dedicaste a cada cuenta este mes? No tenés idea." },
      { icon: Globe, title: "Múltiples números de WhatsApp", text: "Cada cliente en un teléfono diferente. Si alguien falta, nadie puede responder." },
    ],
    features: [
      { icon: Users, title: "Multi-workspace", text: "Cada cliente en su propio espacio de trabajo, con equipos y permisos separados." },
      { icon: FileText, title: "CRM por cliente", text: "Contactos, deals y conversaciones organizados por cuenta, no mezclados." },
      { icon: BarChart2, title: "Reportes de actividad", text: "Mensajes enviados, tiempo de respuesta y conversaciones activas por cliente." },
      { icon: Zap, title: "Automatizaciones por cliente", text: "Flujos de trabajo personalizados para cada cuenta sin duplicar configuraciones." },
    ],
    quote:
      "Antes necesitaba revisar cinco apps distintas para saber cómo iba cada cliente. Hoy tengo todo en un dashboard y puedo tomar decisiones en tiempo real.",
    quoteAuthor: "Director de operaciones, agencia digital",
    ctaHeadline: "Escalá sin caos",
  },

  ecommerce: {
    eyebrow: "Para e-commerce",
    headline: "Convierte consultas en ventas con IA",
    subtext:
      "Respondé al instante, recuperá carritos y fidelizá clientes automáticamente. Tu tienda abierta las 24 horas.",
    pains: [
      { icon: MessageCircle, title: "Preguntas sin respuesta", text: "El cliente pregunta el precio o la talla a las 11 PM y compra en otro lado porque nadie respondió." },
      { icon: ShoppingBag, title: "Carritos abandonados", text: "El 70% de los carritos nunca se pagan. Sin seguimiento automatizado, esa plata se pierde." },
      { icon: Clock, title: "Sin retención post-venta", text: "El cliente compró una vez y nunca más volviste a hablarle. La retención cuesta diez veces menos que la adquisición." },
    ],
    features: [
      { icon: Bot, title: "Agente IA 24/7", text: "Respondé preguntas de producto, disponibilidad y envíos en segundos, sin intervención humana." },
      { icon: Zap, title: "Notificaciones proactivas", text: "Confirmación de orden, tracking de envío y encuesta post-entrega enviados automáticamente." },
      { icon: Repeat, title: "Estado de pedido automático", text: "El cliente pregunta '¿dónde está mi pedido?' y el bot responde con el link de tracking al instante." },
      { icon: TrendingUp, title: "CRM de compradores", text: "Historial de compras, valor de vida del cliente y segmentación para campañas de re-activación." },
    ],
    quote:
      "Implementamos el agente IA en WhatsApp y en tres semanas la tasa de conversión de consultas subió un 40%. Los clientes quieren respuestas rápidas.",
    quoteAuthor: "Fundadora, tienda de cosméticos online",
    ctaHeadline: "Tu tienda, abierta las 24 horas",
  },
};

export default function SolutionPage({ slug }: { slug: string }) {
  const config = SOLUTIONS[slug];
  if (!config) return <Redirect to="/" />;

  const { eyebrow, headline, subtext, pains, features, quote, quoteAuthor, ctaHeadline } = config;

  return (
    <div className="min-h-screen" style={{ background: BG }}>
      {/* Nav */}
      <header className="border-b bg-white px-4 py-4 md:px-8" style={{ borderColor: BORDER }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/"><BrandLockup compact /></Link>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-gray-500 hover:text-gray-900 transition">Ver precios</Link>
            <Link
              href="/register"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: ACCENT }}
            >
              Empezar gratis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 py-20 md:px-8 text-center">
        <span
          className="inline-block rounded-full px-3 py-1 text-xs font-semibold mb-6"
          style={{ background: `${ACCENT}15`, color: ACCENT }}
        >
          {eyebrow}
        </span>
        <h1 className="font-marketing text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl mb-6 max-w-2xl mx-auto">
          {headline}
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto mb-10 leading-relaxed">
          {subtext}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: ACCENT }}
          >
            Empezar gratis
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/#demo"
            className="inline-flex items-center gap-2 rounded-xl border px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            style={{ borderColor: BORDER }}
          >
            Ver demo
          </Link>
        </div>
      </section>

      {/* Pain points */}
      <section className="mx-auto max-w-5xl px-4 pb-16 md:px-8">
        <p className="text-center text-sm font-semibold uppercase tracking-wider text-gray-400 mb-8">
          ¿Te suena familiar?
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {pains.map(({ icon: Icon, title, text }, idx) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: idx * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border bg-white p-6"
              style={{ borderColor: BORDER }}
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-red-50">
                <Icon className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-4 py-16 md:px-8">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: ACCENT }}>
            La solución
          </p>
          <h2 className="font-marketing text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Todo lo que necesitás, sin lo que no necesitás
          </h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, text }, idx) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: idx * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border bg-white p-6 flex gap-4"
              style={{ borderColor: BORDER }}
            >
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ background: `${ACCENT}12` }}
              >
                <Icon className="h-5 w-5" style={{ color: ACCENT }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{text}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="mx-auto max-w-3xl px-4 py-12 md:px-8">
        <div
          className="rounded-2xl border bg-white p-8 text-center"
          style={{ borderColor: BORDER }}
        >
          <div className="flex justify-center mb-5">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className="h-4 w-4 text-amber-400 fill-current" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <blockquote className="text-base text-gray-700 leading-relaxed mb-4 italic">
            "{quote}"
          </blockquote>
          <p className="text-xs text-gray-400">{quoteAuthor}</p>
        </div>
      </section>

      {/* Feature checklist */}
      <section className="mx-auto max-w-5xl px-4 py-12 md:px-8">
        <div
          className="rounded-2xl border bg-white px-8 py-10"
          style={{ borderColor: BORDER }}
        >
          <h3 className="font-marketing text-base font-semibold text-gray-900 mb-6 text-center">
            Incluido en todos los planes
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {[
              "Bandeja omnicanal unificada",
              "Agente IA personalizable",
              "CRM de contactos",
              "Asignación de conversaciones",
              "Automatizaciones de flujo",
              "Facturación integrada",
              "Reportes de actividad",
              "Soporte por WhatsApp",
              "Acceso multiusuario",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                <span className="text-sm text-gray-600">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="mx-auto max-w-5xl px-4 py-12 md:px-8">
        <div
          className="rounded-3xl px-8 py-14 text-center text-white"
          style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, #8B73F0 100%)` }}
        >
          <h2 className="font-marketing text-2xl font-bold tracking-tight mb-3 sm:text-3xl">
            {ctaHeadline}
          </h2>
          <p className="text-white/70 text-sm mb-8 max-w-md mx-auto">
            Probá PymesHub gratis por 14 días. Sin tarjeta de crédito, sin contratos.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold transition hover:bg-gray-50"
            style={{ color: ACCENT }}
          >
            Empezar gratis
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
