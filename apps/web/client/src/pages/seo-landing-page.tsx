import { useEffect } from "react";
import { ArrowRight, CheckCircle2, MapPin, ShieldCheck, Bike } from "lucide-react";
import { Link } from "wouter";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { applySeoMetadata, buildSoftwareSchema } from "@/lib/seo";

interface SeoPageConfig {
  slug: string;
  eyebrow: string;
  title: string;
  description: string;
  primaryKeyword: string;
  bullets: string[];
  sections: Array<{
    title: string;
    body: string;
  }>;
  faqs: Array<{
    answer: string;
    question: string;
  }>;
  related: string[];
}

// Los slugs son rutas públicas ya registradas en App.tsx; el contenido cambió al
// relato de delivery sin romper las URLs.
export const seoPages: Record<string, SeoPageConfig> = {
  "whatsapp-shared-inbox": {
    slug: "whatsapp-shared-inbox",
    eyebrow: "Delivery de comida",
    title: "Delivery de comida de los restaurantes de tu barrio",
    description:
      "Pedí de sodas, restaurantes y food trucks cercanos con catálogos reales, entrega a domicilio y seguimiento del pedido en vivo.",
    primaryKeyword: "delivery de comida",
    bullets: [
      "Restaurantes y sodas cerca de vos",
      "Menús con precios y horarios reales",
      "Seguí tu pedido hasta la puerta",
    ],
    sections: [
      {
        title: "Todo el barrio, en una sola app",
        body: "PymesHub reúne los comercios de comida de tu zona en un solo lugar, con catálogos mantenidos por cada negocio. Compará platos, precios y tiempos de entrega sin llamar a nadie.",
      },
      {
        title: "Del antojo a la puerta",
        body: "Armá tu pedido con cantidades y notas especiales, elegí entrega a domicilio o retiro en tienda, pagá en efectivo, tarjeta o transferencia y seguí la entrega en vivo hasta tu dirección.",
      },
    ],
    faqs: [
      {
        question: "¿Cómo hago un pedido de comida?",
        answer:
          "Elegís el restaurante o soda, agregás platos al carrito con tus notas, confirmás la entrega y pagás. El comercio recibe el pedido completo y vos lo seguís en vivo.",
      },
      {
        question: "¿Puedo pagar en efectivo?",
        answer:
          "Sí. Efectivo contra entrega, tarjeta o transferencia. El estado del pago queda registrado junto a tu pedido.",
      },
    ],
    related: ["whatsapp-crm", "team-inbox", "workflow-automation"],
  },
  "crm-for-smbs": {
    slug: "crm-for-smbs",
    eyebrow: "Delivery de abarrotes",
    title: "Delivery de abarrotes: el mandado, sin salir de casa",
    description:
      "Pedí abarrotes, frutas y productos básicos de las pulperías y abastecedores de tu zona, con entrega el mismo día.",
    primaryKeyword: "delivery de abarrotes",
    bullets: [
      "Pulperías y abastecedores locales",
      "Mismo peso, mismos precios de siempre",
      "Entrega el mismo día",
    ],
    sections: [
      {
        title: "El mandado de siempre, ahora en línea",
        body: "Las pulperías y abastecedores de tu barrio publican su catálogo en PymesHub con los precios de siempre. Armá tu lista, mandá el pedido y recibilo en casa el mismo día.",
      },
      {
        title: "Comprás al comercio de siempre",
        body: "No hay intermediarios: tu pedido va directo a la pulpería de tu barrio. El negocio recibe la lista completa y vos seguís la entrega hasta la puerta.",
      },
    ],
    faqs: [
      {
        question: "¿Los precios son los mismos de la tienda?",
        answer:
          "Sí. Cada comercio mantiene su propio catálogo y precios. Lo que ves en la app es lo que cobra el negocio.",
      },
      {
        question: "¿Hasta dónde entregan?",
        answer:
          "Cada comercio define su zona de cobertura. Si estás fuera de su radio, podés elegir retiro en tienda.",
      },
    ],
    related: ["client-management", "whatsapp-crm", "invoicing"],
  },
  "client-management": {
    slug: "client-management",
    eyebrow: "Delivery de farmacia",
    title: "Delivery de farmacia cuando no podés salir",
    description:
      "Medicamentos de venta libre, artículos de cuidado personal y más, entregados por las farmacias de tu comunidad.",
    primaryKeyword: "delivery de farmacia",
    bullets: [
      "Farmacias de tu comunidad",
      "Artículos de venta libre y cuidado personal",
      "Pedidos con notas para el farmacéutico",
    ],
    sections: [
      {
        title: "Lo que necesitás, sin moverte de casa",
        body: "Cuando alguien está enfermo en casa, salir no es opción. Las farmacias registradas en PymesHub reciben tu pedido con las notas necesarias y te lo llevan a la puerta.",
      },
      {
        title: "Claro y sin confusiones",
        body: "El pedido llega completo al comercio: producto, cantidad y tus notas. El farmacéutico confirma y el estado del pedido se actualiza en vivo hasta la entrega.",
      },
    ],
    faqs: [
      {
        question: "¿Puedo pedir medicamentos con receta?",
        answer:
          "La app sirve para productos de venta libre y cuidado personal. Los medicamentos con receta los coordina directamente cada farmacia según su política — podés dejar una nota en el pedido.",
      },
      {
        question: "¿Qué tan rápido llega?",
        answer:
          "Depende de cada farmacia: el horario de atención y la hora estimada de entrega son visibles antes de confirmar el pedido.",
      },
    ],
    related: ["crm-for-smbs", "team-inbox", "workflow-automation"],
  },
  "workflow-automation": {
    slug: "workflow-automation",
    eyebrow: "Ferretería a domicilio",
    title: "Ferretería a domicilio para el proyecto de fin de semana",
    description:
      "Herramientas, materiales y repuestos de las ferreterías de tu zona, entregados cuando estás en medio del proyecto.",
    primaryKeyword: "ferretería a domicilio",
    bullets: [
      "Ferreterías de tu zona",
      "Herramientas, materiales y repuestos",
      "Entrega al obraje o a la casa",
    ],
    sections: [
      {
        title: "Que el proyecto no se detenga",
        body: "Cuando falta un tornillo a media obra, ir a la ferretería detiene todo. Las ferreterías de PymesHub reciben tu pedido con la lista exacta y lo entregan donde estés trabajando.",
      },
      {
        title: "Pedidos que se entienden a la primera",
        body: "Cada pedido lleva producto, medida y notas del cliente. La ferretería confirma disponibilidad y el estado del pedido se ve en vivo hasta la entrega.",
      },
    ],
    faqs: [
      {
        question: "¿Puedo pedir materiales por cantidad?",
        answer:
          "Sí. El carrito admite cantidades y notas especiales — medidas, colores, referencias — para que la ferretería prepare exactamente lo que necesitás.",
      },
      {
        question: "¿Entregan en obra?",
        answer:
          "Cada ferretería define su zona de entrega, que puede incluir direcciones de obra. Dejá la referencia en las notas del pedido.",
      },
    ],
    related: ["whatsapp-shared-inbox", "team-inbox", "invoicing"],
  },
  "whatsapp-crm": {
    slug: "whatsapp-crm",
    eyebrow: "Seguimiento de pedidos",
    title: "Seguí tu pedido en vivo, de la confirmación a la puerta",
    description:
      "Cada pedido en PymesHub pasa por estados claros — confirmado, preparando, en camino — con hora estimada siempre visible.",
    primaryKeyword: "seguimiento de pedidos",
    bullets: [
      "Estado en vivo del pedido",
      "Hora estimada de entrega",
      "Historial para volver a pedir",
    ],
    sections: [
      {
        title: "Nunca más “¿dónde va mi pedido?”",
        body: "Cada pedido muestra su estado actual: confirmado, preparando, en camino o entregado. La hora estimada se actualiza con el comercio y ves todo sin llamar ni escribir.",
      },
      {
        title: "Pedidos anteriores, un toque de distancia",
        body: "Tu historial guarda cada pedido para que puedas volver a pedir tus favoritos en segundos, con las mismas notas y la misma dirección.",
      },
    ],
    faqs: [
      {
        question: "¿Qué estados tiene un pedido?",
        answer:
          "Confirmado, preparando, en camino y entregado. Si el comercio rechaza o cancela, también queda visible con la razón.",
      },
      {
        question: "¿Puedo contactar al comercio durante la entrega?",
        answer:
          "Sí. Cada pedido tiene un espacio para escribirle al comercio por si algo cambia en la entrega.",
      },
    ],
    related: ["whatsapp-shared-inbox", "crm-for-smbs", "client-management"],
  },
  invoicing: {
    slug: "invoicing",
    eyebrow: "Pago contra entrega",
    title: "Pago contra entrega: efectivo, tarjeta o transferencia",
    description:
      "Pagá como prefieras al recibir tu pedido. El estado del pago queda registrado junto al pedido, sin cuadernos ni capturas.",
    primaryKeyword: "pago contra entrega",
    bullets: [
      "Efectivo contra entrega",
      "Tarjeta o transferencia en línea",
      "Estado de pago registrado por pedido",
    ],
    sections: [
      {
        title: "Tu plata, tu momento",
        body: "El pago contra entrega es la forma más natural de comprar en el barrio: recibís el pedido, contás el efectivo y listo. En PymesHub el pago queda registrado junto al pedido.",
      },
      {
        title: "Si preferís pagar en línea",
        body: "También podés pagar con tarjeta o transferencia al confirmar el pedido. El comercio ve el pago confirmado antes de preparar la entrega.",
      },
    ],
    faqs: [
      {
        question: "¿Puedo pagar con efectivo al recibo?",
        answer:
          "Sí. Elegí efectivo como método de pago al confirmar. Prepará el monto exacto si podés — el repartidor puede no llevar cambio.",
      },
      {
        question: "¿Cómo sabe el comercio que pagué en línea?",
        answer:
          "El estado del pago se actualiza automáticamente en el pedido. El comercio lo ve antes de preparar tu entrega.",
      },
    ],
    related: ["crm-for-smbs", "workflow-automation", "client-management"],
  },
  "team-inbox": {
    slug: "team-inbox",
    eyebrow: "Pedidos para retiro",
    title: "Retiro en tienda: pedí de antemano, pasá por ello",
    description:
      "Armá tu pedido, elegí retiro en tienda y pasá a buscarlo cuando esté listo. Sin filas, sin esperar en el mostrador.",
    primaryKeyword: "retiro en tienda",
    bullets: [
      "Pedidos listos cuando llegués",
      "Sin mínimo de compra",
      "Pagás al retirar o en línea",
    ],
    sections: [
      {
        title: "Pedí de antemano, pasá por ello",
        body: "Si pasás de todos modos frente a la soda o la panadería, el retiro en tienda te ahorra la espera: el pedido se prepara con anticipación y te avisan cuando está listo.",
      },
      {
        title: "El mismo catálogo, sin delivery",
        body: "Retiro en tienda usa el mismo catálogo y los mismos precios que la entrega a domicilio. Vos elegís el método al confirmar el pedido.",
      },
    ],
    faqs: [
      {
        question: "¿Cómo sé que mi pedido está listo?",
        answer:
          "El comercio actualiza el estado del pedido a preparando y luego a listo para retirar. Recibís la confirmación en la app.",
      },
      {
        question: "¿Puedo pagar al retirar?",
        answer:
          "Sí. Podés pagar en efectivo o con tarjeta al retirar, o pagar en línea al confirmar el pedido.",
      },
    ],
    related: ["whatsapp-shared-inbox", "client-management", "workflow-automation"],
  },
};

function createFaqSchema(config: SeoPageConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: config.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

const ACCENT = "#F59E0B";

export default function SeoLandingPage({ slug }: { slug: string }) {
  const config = seoPages[slug];

  useEffect(() => {
    if (!config) return;

    applySeoMetadata({
      canonicalPath: `/${config.slug}`,
      description: config.description,
      title: `${config.title} | PymesHub`,
      jsonLd: {
        "@context": "https://schema.org",
        "@graph": [
          buildSoftwareSchema(
            `/${config.slug}`,
            config.title,
            config.description,
          ),
          createFaqSchema(config),
        ],
      },
    });
  }, [config]);

  if (!config) return null;

  return (
    <div className="min-h-screen bg-[#05091d] text-slate-100">
      <main>
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 md:px-8">
          <Link href="/" aria-label="PymesHub home">
            <BrandLockup compact />
          </Link>
          <div className="flex items-center gap-2 md:gap-4">
            <LanguageSwitcher variant="marketing" />
            <Link
              href="/pricing"
              className="font-marketing rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:border-amber-500/40 hover:text-white"
            >
              Precios
            </Link>
          </div>
        </nav>

        <section className="px-4 py-14 md:px-8 md:py-20">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.04fr_0.96fr] lg:items-center">
            <article>
              <p className="font-marketing text-sm font-semibold uppercase tracking-[0.3em] text-amber-400">
                {config.eyebrow}
              </p>
              <h1 className="font-marketing mt-5 text-4xl font-bold tracking-[-0.04em] text-white md:text-5xl">
                {config.title}
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
                {config.description}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/categories"
                  className="group relative inline-flex h-12 items-center justify-center gap-[1.6em] px-8 font-marketing text-[0.875rem] font-semibold uppercase leading-none tracking-[0.08em]"
                >
                  <svg aria-hidden="true" viewBox="0 0 220 50" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                    <path d="M220 42L212.932 50H0V0H220V42Z" className="fill-[#0E0F14]" />
                    <path d="M220 42L212.932 50H0V0H220V42Z" className="fill-[#f59e0b] origin-left scale-x-0 transition-transform duration-[250ms] ease-[cubic-bezier(0.33,0,0,1)] group-hover:scale-x-100" />
                    <path d="M220 42L212.932 50H0V0H220V42Z" fill="none" stroke="#f59e0b" strokeOpacity="0.25" />
                    <path d="M205 49.5H213L219.5 42V36 M212 0.5H219.5V7 M8 0.5H0.5V7 M7.5 49.5H0.5V42.5" fill="none" className="stroke-[#f59e0b]" />
                  </svg>
                  <span className="relative z-10 text-[#f59e0b] transition-colors duration-[250ms] group-hover:text-[#05091d]">Empezar a pedir</span>
                  <ArrowRight className="relative z-10 h-3.5 w-3.5 text-[#f59e0b] transition-all duration-150 group-hover:translate-x-1 group-hover:text-[#05091d]" />
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 font-marketing text-sm font-semibold text-slate-200 transition hover:border-white/25"
                >
                  Ver PymesHub
                </Link>
              </div>
            </article>

            <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
                  <MapPin className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-marketing text-xs uppercase tracking-[0.24em] text-slate-400">
                    Tema principal
                  </p>
                  <h2 className="font-marketing text-xl font-semibold tracking-[-0.02em] text-white">
                    {config.primaryKeyword}
                  </h2>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                {config.bullets.map((bullet) => (
                  <div
                    key={bullet}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-amber-400" />
                    <span className="text-sm text-slate-300">{bullet}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="px-4 pb-20 md:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
            {config.sections.map((section, index) => (
              <article
                key={section.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8"
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
                  {index === 0 ? (
                    <Bike className="h-5 w-5" />
                  ) : (
                    <ShieldCheck className="h-5 w-5" />
                  )}
                </div>
                <h2 className="font-marketing text-2xl font-semibold tracking-[-0.03em] text-white">
                  {section.title}
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-400">
                  {section.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="px-4 pb-20 md:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <p className="font-marketing text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">FAQ</p>
              <h2 className="font-marketing mt-3 text-3xl font-bold tracking-[-0.04em] text-white">
                Preguntas frecuentes sobre {config.primaryKeyword}
              </h2>
            </div>
            <div className="mt-8 grid gap-4">
              {config.faqs.map((faq) => (
                <article
                  key={faq.question}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <h3 className="font-marketing text-lg font-semibold text-white">
                    {faq.question}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-400">
                    {faq.answer}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 px-4 py-10 md:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="font-marketing text-sm uppercase tracking-[0.26em] text-slate-500">
              Páginas relacionadas
            </p>
            <div className="flex flex-wrap gap-3">
              {config.related.map((relatedSlug) => (
                <Link
                  key={relatedSlug}
                  href={`/${relatedSlug}`}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:border-amber-500/40 hover:text-white"
                >
                  {seoPages[relatedSlug]?.primaryKeyword ?? relatedSlug}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
