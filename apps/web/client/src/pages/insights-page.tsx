import { Link } from "wouter";
import { ArrowLeft, ShoppingBag, Clock, ShieldCheck, ExternalLink } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { Footer } from "@/components/marketing/footer";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

const CARD_ICONS = [ShoppingBag, Clock, ShieldCheck];

export default function InsightsPage() {
  const { messages } = useI18n();
  const copy = messages.landing?.menus?.insights || {} as any;
  const cards = (copy.cards || []) as readonly { title: string; desc: string; example?: string }[];

  return (
    <div className="marketplace-theme relative min-h-screen overflow-hidden bg-[#05091d] text-white">
      <div className="pointer-events-none absolute inset-0"><div className="absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(245,158,11,0.06),transparent_36%)]" /></div>
      <main className="relative z-10">
        <nav className="flex items-center justify-between px-4 py-5 md:px-8">
          <Link href="/"><BrandLockup compact textClassName="text-white" /></Link>
          <div className="flex items-center gap-2 md:gap-4">
            <LanguageSwitcher variant="marketing" />
            <Link href="/product" className="font-marketing text-sm font-medium text-white/70 hover:text-white"><ArrowLeft className="mr-1 inline h-4 w-4" />Producto</Link>
          </div>
        </nav>
        <section className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="font-marketing text-sm font-semibold uppercase tracking-[0.36em] text-[#F59E0B]/80">{copy.eyebrow || "Para comercios"}</p>
              <h1 className="font-marketing mt-5 text-4xl font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-5xl md:text-6xl">{copy.title || "Tu negocio, con tienda propia y entrega a domicilio."}</h1>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-400 md:text-lg">{copy.description || "Cada comercio recibe pedidos organizados — con artículos, dirección y notas — sin volver loco el WhatsApp."}</p>
            </div>
            <div className="mt-16 grid gap-6 md:grid-cols-3">
              {cards.map(({ title, desc, example }, i) => {
                const Icon = CARD_ICONS[i % CARD_ICONS.length];
                return (
                <article key={title} className="rounded-[28px] border border-white/10 bg-white/[0.03] p-7">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10"><Icon className="h-6 w-6 text-amber-400" /></div>
                  <h3 className="font-marketing mt-6 text-xl font-semibold tracking-[-0.03em]">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-400">{desc}</p>
                  {example && <p className="mt-4 inline-block rounded-lg bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-400">{example}</p>}
                </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-4 pb-16 md:px-8 md:pb-24">
          <div className="mx-auto max-w-7xl">
            <h2 className="font-marketing text-center text-3xl font-bold tracking-[-0.04em] text-white">Empezá ahora</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                { href: "/register", title: "Registrar mi comercio", desc: "Creá tu tienda con catálogo, horarios y radio de entrega." },
                { href: "/pricing", title: "Ver planes", desc: "Pagos mensuales simples, sin comisión por pedido." },
                { href: "/categories", title: "Ver el marketplace", desc: "Conocé los negocios que ya entregan en tu zona." },
              ].map(({ href, title, desc }) => (
                <Link key={href} href={href} className="group flex flex-col rounded-xl border border-white/10 bg-white/[0.02] p-5 transition-all duration-200 hover:border-amber-500/40 hover:bg-white/[0.04]">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white group-hover:text-white/90">
                      {title}
                      <ExternalLink className="h-3.5 w-3.5 text-white/30" />
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-slate-500">{desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
