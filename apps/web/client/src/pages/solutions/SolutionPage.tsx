import { motion } from "framer-motion";
import { Link, Redirect } from "wouter";
import {
  ArrowRight, CheckCircle2, Inbox, Bike, MapPin, Users,
  ShoppingBag, Globe, Repeat,
  MessageCircle, AlertCircle, Clock, TrendingUp,
} from "lucide-react";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { Footer } from "@/components/marketing/footer";

const ACCENT = "#F59E0B";
const BG = "#05091d";
const BORDER = "rgba(255,255,255,0.08)";

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
    eyebrow: "Para sodas y restaurantes",
    headline: "Tu cocina, entregando pedidos sin caos",
    subtext:
      "Recibí cada pedido completo — platos, cantidades y notas — sin llamadas ni audios. Tu equipo prepara, tu cliente sigue la entrega.",
    pains: [
      { icon: AlertCircle, title: "Pedidos por teléfono", text: "Tomás pedidos mientras cocinás. Se pierden datos, se confunden cantidades, se enfría la comida." },
      { icon: MessageCircle, title: "WhatsApp saturado", text: "Audios, capturas y '¿me confirmás?' a toda hora. Nadie sabe qué pedido va primero." },
      { icon: Clock, title: "Entregas a ciegas", text: "El cliente pregunta dónde va su pedido y tenés que parar todo para averiguarlo." },
    ],
    features: [
      { icon: Inbox, title: "Pedidos organizados", text: "Cada pedido llega con artículos, dirección y notas del cliente, listo para confirmar." },
      { icon: Bike, title: "Estado en vivo", text: "Confirmado, preparando, en camino — el cliente lo ve todo sin llamarte." },
      { icon: ShoppingBag, title: "Catálogo al día", text: "Tu menú con precios y fotos, actualizado por vos. Lo que mostrás es lo que vendés." },
      { icon: TrendingUp, title: "Resumen del día", text: "Pedidos por estado y totales, listos para cerrar la caja sin sorpresas." },
    ],
    quote:
      "Antes tomábamos pedidos al teléfono entre los Fuegos. Ahora entran ordenados, con la dirección y las notas, y nadie llama a preguntar dónde va.",
    quoteAuthor: "Encargada, soda de barrio · Costa Rica",
    ctaHeadline: "Menos teléfono, más cocina",
  },

  retail: {
    eyebrow: "Para pulperías y abarrotes",
    headline: "El mandado de tus vecinos, entregado a tiempo",
    subtext:
      "Publicá tu catálogo con los precios de siempre y recibí listas completas de compras, no mensajes sueltos a media tarde.",
    pains: [
      { icon: MessageCircle, title: "Listas por chat", text: "El cliente manda su lista por audio o captura. Averiguar qué pidió exactamente toma más que surtirlo." },
      { icon: AlertCircle, title: "Sin registro de fiados", text: "Quién debe qué queda en la memoria o en un cuaderno que nadie encuentra." },
      { icon: Clock, title: "Precios desactualizados", text: "Cambiás un precio y tus clientes se enteran cuando ya están en la caja." },
    ],
    features: [
      { icon: ShoppingBag, title: "Catálogo con precios reales", text: "Actualizá precios al instante; el cliente siempre ve lo correcto antes de pedir." },
      { icon: Inbox, title: "Listas completas", text: "Cada pedido llega con productos, cantidades y sustituciones aceptadas." },
      { icon: Users, title: "Clientes frecuentes", text: "Historial de compras por cliente para surtir más rápido a los de siempre." },
      { icon: TrendingUp, title: "Ventas visibles", text: "Qué se vende, cuándo y cuánto — sin hojas de cálculo." },
    ],
    quote:
      "La gente manda su lista por la app y yo solo surto. Ya no paso media tarde descifrando audios.",
    quoteAuthor: "Dueño, abastecedor de barrio · Heredia",
    ctaHeadline: "Tu pulpería, también en línea",
  },

  services: {
    eyebrow: "Para farmacias",
    headline: "Lo que se necesita, entregado a la puerta",
    subtext:
      "Recibí pedidos de cuidado personal y venta libre con notas claras, y coordená la entrega sin descifrar letras de médico.",
    pains: [
      { icon: Clock, title: "Pedidos urgentes por llamada", text: "Atender el teléfono mientras atendés el mostrador, con el cliente esperando de ambos lados." },
      { icon: AlertCircle, title: "Datos confusos", text: "Nombres de productos mal escritos, sin presentación ni cantidad, siempre al teléfono otra vez." },
      { icon: Globe, title: "¿Hasta dónde entregamos?", text: "Cada pedido llega con la misma pregunta: ¿ustedes llegan hasta allá?" },
    ],
    features: [
      { icon: Inbox, title: "Pedidos con notas", text: "Producto, cantidad y las notas del cliente visibles antes de confirmar." },
      { icon: MapPin, title: "Zona de entrega clara", text: "Definí tu radio de cobertura una vez; la app le avisa al cliente por vos." },
      { icon: ShoppingBag, title: "Catálogo de venta libre", text: "Lo que tenés disponible, con fotos y presentaciones, siempre al día." },
      { icon: TrendingUp, title: "Pedidos del día", text: "Todo lo que entra, agrupado y con su estado de entrega." },
    ],
    quote:
      "El pedido llega con el producto y la nota del cliente. Confirmo, preparo y listo. Ya no juego al teléfono.",
    quoteAuthor: "Farmacia de comunidad · San José",
    ctaHeadline: "Tu farmacia, sin interrupciones",
  },

  agencies: {
    eyebrow: "Para ferreterías",
    headline: "El material correcto, en la obra correcta",
    subtext:
      "Recibí listas de materiales completas con medidas y referencias, y entregá donde el cliente está trabajando.",
    pains: [
      { icon: MessageCircle, title: "Listas a media obra", text: "El cliente manda lo que necesita en un mensaje confuso y vos tenés que adivinar la referencia." },
      { icon: AlertCircle, title: "Existencias al aire", text: "Vendés lo que no tenés y el cliente espera el doble. O tenés stock muerto que no se mueve." },
      { icon: Clock, title: "Entregas improvisadas", text: "Coordinar cada entrega por teléfono roba el tiempo del mostrador." },
    ],
    features: [
      { icon: ShoppingBag, title: "Catálogo con existencias", text: "Mostrá solo lo que hay; el cliente no pide lo que no tenés." },
      { icon: Inbox, title: "Listas estructuradas", text: "Producto, medida y referencia en cada línea del pedido." },
      { icon: MapPin, title: "Entrega en obra", text: "El cliente deja la referencia de la obra en las notas y tu repartidor llega directo." },
      { icon: TrendingUp, title: "Lo más pedido", text: "Sabé qué materiales rota'n más y mantené stock de lo que importa." },
    ],
    quote:
      "Los pedidos llegan con medidas y referencias. Preparo el pedido y lo mando con el primer viaje.",
    quoteAuthor: "Ferretería de barrio · Cartago",
    ctaHeadline: "Menos adivinanzas, más obras terminadas",
  },

  ecommerce: {
    eyebrow: "Para panaderías y cafeterías",
    headline: "El pedido de la mañana, resuelto la noche anterior",
    subtext:
      "Tus clientes frecuentes ordenan con anticipación; vos preparás lo que ya está vendido. Menos desperdicio, más pan caliente.",
    pains: [
      { icon: MessageCircle, title: "Pedidos por encargo por chat", text: "Encargos de tortas y cajas para la oficina viviendo en un chat que nadie revisa." },
      { icon: ShoppingBag, title: "Producción a ciegas", text: "Horneás de más y se pierde producto, o de menos y quedás corto con los encargos." },
      { icon: Clock, title: "Horarios confusos", text: "El cliente no sabe si todavía hay pan o si ya cerró los pedidos del día." },
    ],
    features: [
      { icon: ShoppingBag, title: "Encargos con anticipación", text: "El cliente pide para hoy o para mañana; vos planificás la hornada real." },
      { icon: Clock, title: "Cortes de pedidos claros", text: "Definí hasta qué hora se pide para cada horario de entrega." },
      { icon: Inbox, title: "Encargos organizados", text: "Personalización, cantidades y fecha de entrega en cada pedido." },
      { icon: TrendingUp, title: "Favoritos del barrio", text: "Vos sabé qué se pide más y tené listo lo que siempre falta." },
    ],
    quote:
      "Los encargos llegan con fecha y detalle. Preparo lo vendido y el pan sale caliente a la hora justa.",
    quoteAuthor: "Panadería de barrio · Alajuela",
    ctaHeadline: "Tu horno, siempre con encargo",
  },
};

export default function SolutionPage({ slug }: { slug: string }) {
  const config = SOLUTIONS[slug];
  if (!config) return <Redirect to="/" />;

  const { eyebrow, headline, subtext, pains, features, quote, quoteAuthor, ctaHeadline } = config;

  return (
    <div className="min-h-screen" style={{ background: BG }}>
      {/* Nav */}
      <header className="border-b bg-white/[0.02] px-4 py-4 md:px-8" style={{ borderColor: BORDER }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/"><BrandLockup compact /></Link>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-slate-400 hover:text-white transition">Precios para comercios</Link>
            <Link
              href="/register"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90"
              style={{ background: ACCENT }}
            >
              Registrar mi comercio
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 py-20 md:px-8 text-center">
        <span
          className="inline-block rounded-full px-3 py-1 text-xs font-semibold mb-6"
          style={{ background: "rgba(245,158,11,0.12)", color: ACCENT }}
        >
          {eyebrow}
        </span>
        <h1 className="font-marketing text-4xl font-bold tracking-tight text-white sm:text-5xl mb-6 max-w-2xl mx-auto">
          {headline}
        </h1>
        <p className="text-lg text-slate-400 max-w-xl mx-auto mb-10 leading-relaxed">
          {subtext}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90"
            style={{ background: ACCENT }}
          >
            Registrar mi comercio
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/categories"
            className="inline-flex items-center gap-2 rounded-xl border px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
            style={{ borderColor: BORDER }}
          >
            Ver la tienda
          </Link>
        </div>
      </section>

      {/* Pain points */}
      <section className="mx-auto max-w-5xl px-4 pb-16 md:px-8">
        <p className="text-center text-sm font-semibold uppercase tracking-wider text-slate-500 mb-8">
          ¿Pasa esto en tu negocio?
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {pains.map(({ icon: Icon, title, text }, idx) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: idx * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border bg-white/[0.03] p-6"
              style={{ borderColor: BORDER }}
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10">
                <Icon className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-4 py-16 md:px-8">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: ACCENT }}>
            Qué cambia
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, text }, idx) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: idx * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border bg-white/[0.03] p-6 flex gap-4"
              style={{ borderColor: BORDER }}
            >
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/10"
              >
                <Icon className="h-5 w-5" style={{ color: ACCENT }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{text}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="mx-auto max-w-3xl px-4 py-12 md:px-8">
        <div
          className="rounded-2xl border bg-white/[0.03] p-8 text-center"
          style={{ borderColor: BORDER }}
        >
          <div className="flex justify-center mb-5">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className="h-4 w-4 text-amber-400 fill-current" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <blockquote className="text-base text-slate-200 leading-relaxed mb-4 italic">
            "{quote}"
          </blockquote>
          <p className="text-xs text-slate-500">{quoteAuthor}</p>
        </div>
      </section>

      {/* Feature checklist */}
      <section className="mx-auto max-w-5xl px-4 py-12 md:px-8">
        <div
          className="rounded-2xl border bg-white/[0.03] px-8 py-10"
          style={{ borderColor: BORDER }}
        >
          <h3 className="font-marketing text-base font-semibold text-white mb-6 text-center">
            Incluido en todos los planes de comercio
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {[
              "Tienda propia con catálogo",
              "Pedidos a domicilio y retiro",
              "Efectivo, tarjeta o transferencia",
              "Estado del pedido en vivo",
              "Notas del cliente en cada pedido",
              "Zona y horario de entrega propios",
              "Resumen de pedidos del día",
              "Soporte local en Costa Rica",
              "Sin comisión por pedido",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-amber-400" />
                <span className="text-sm text-slate-300">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="mx-auto max-w-5xl px-4 py-12 md:px-8">
        <div
          className="rounded-3xl px-8 py-14 text-center text-white"
          style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.16) 0%, rgba(245,158,11,0.04) 100%)", border: "1px solid rgba(245,158,11,0.25)" }}
        >
          <h2 className="font-marketing text-2xl font-bold tracking-tight mb-3 sm:text-3xl">
            {ctaHeadline}
          </h2>
          <p className="text-slate-300 text-sm mb-8 max-w-md mx-auto">
            Registrá tu comercio, armá tu catálogo y empezá a recibir pedidos organizados. Sin costo de instalación, sin comisión por pedido.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
          >
            Registrar mi comercio
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
