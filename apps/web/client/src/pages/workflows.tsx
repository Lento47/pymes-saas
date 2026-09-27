import { Link } from "wouter";
import { ArrowLeft, ShoppingCart, CreditCard, MapPin, ExternalLink } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { Footer } from "@/components/marketing/footer";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

const LINK_ICONS = [ShoppingCart, CreditCard, MapPin];

export default function WorkflowsPage() {
  const { messages } = useI18n();
  const copy = messages.landing?.menus?.workflows || {} as any;
  const links = (copy.links || []) as readonly { title: string; description: string }[];

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
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.08fr_0.92fr]">
            <article className="rounded-[34px] border border-white/10 bg-white/[0.03] p-8 md:p-10">
              <p className="font-marketing text-sm font-semibold uppercase tracking-[0.36em] text-[#F59E0B]/80">{copy.eyebrow || "Cómo funciona"}</p>
              <h1 className="font-marketing mt-5 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">{copy.title || "Un pedido claro, de punta a punta."}</h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-400">{copy.description || "Del carrito a la puerta: cada paso del pedido es visible para el cliente y para el comercio."}</p>
            </article>
            <div className="space-y-4">
              {links.map(({ title, description }, i) => {
                const Icon = LINK_ICONS[i % LINK_ICONS.length];
                return (
                  <article key={title} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400"><Icon className="h-5 w-5" /></div>
                    <div><h3 className="font-marketing text-sm font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-400">{description}</p></div>
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
                { href: "/categories", title: "Explorar categorías", desc: "Comida, abarrotes, farmacia y ferretería cerca de vos." },
                { href: "/orders", title: "Mis pedidos", desc: "Seguí tus entregas en vivo, paso a paso." },
                { href: "/pricing", title: "Vendé en PymesHub", desc: "Planes para comercios que entregan a domicilio." },
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
