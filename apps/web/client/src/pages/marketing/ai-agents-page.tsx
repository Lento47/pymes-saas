import { useEffect } from "react";
import { Footer } from "@/components/marketing/footer";
import {
  MarketingShell,
  AgentConsole,
  AutomationRecipe,
  FinalCta,
  ProductPageHero,
} from "@/components/marketing/marketing-site";
import { ScrambleText } from "@/components/marketing/scramble-text";
import { BLOCK_CHARS } from "@/hooks/use-scramble-text";
import { useI18n } from "@/components/providers/i18n-provider";
import { applySeoMetadata } from "@/lib/seo";
import { ShieldCheck } from "lucide-react";

// Live order operations shown per merchant workflow — same data a merchant
// sees on their panel, no code-style logs.
const TRACE_STEPS: Record<string, { step: string; detail: string }[]> = {
  reception: [
    { step: "Pedido #1042 recibido",     detail: "3 artículos · nota: \"sin cebolla\"" },
    { step: "Dirección confirmada",      detail: "Barrio Amón · 1.2 km" },
    { step: "Pago elegido",              detail: "Efectivo contra entrega" },
    { step: "Pedido confirmado",         detail: "Cliente notificado · sale en 10 min" },
  ],
  sales: [
    { step: "Pedido #1039 entregado",    detail: "₡6 800 en efectivo" },
    { step: "Pedido #1040 entregado",    detail: "₡4 200 con tarjeta" },
    { step: "Pedido #1041 transferencia",detail: "Comprobante registrado" },
    { step: "Cierre del día",            detail: "12 pedidos · ₡58 400 registrados" },
  ],
  support: [
    { step: "Horario de hoy",            detail: "Abierto · 8:00–19:00" },
    { step: "Radio de entrega",          detail: "5 km · 25 min promedio" },
    { step: "Retiro en tienda",          detail: "Disponible" },
    { step: "Catálogo",                  detail: "34 productos visibles" },
  ],
  billing: [
    { step: "Pedidos de hoy",            detail: "12 confirmados · 3 en camino" },
    { step: "Por estado",                detail: "4 preparando · 5 entregados" },
    { step: "Totales",                   detail: "₡58 400 registrados" },
    { step: "Resumen",                   detail: "Listo para preparar la entrega" },
  ],
};

export default function AiAgentsPage() {
  const { messages } = useI18n();
  const t = messages.site.agents;
  const au = messages.site.automation;

  useEffect(() => {
    applySeoMetadata({
      canonicalPath: "/ai-agents",
      title: "PymesHub | " + t.page.title,
      description: t.page.subtitle,
    });
  }, [t]);

  const agentList = [
    { id: "reception", ...t.list.reception },
    { id: "sales",     ...t.list.sales     },
    { id: "support",   ...t.list.support   },
    { id: "billing",   ...t.list.billing   },
  ];

  return (
    <MarketingShell>

      {/* ── Hero ── */}
      <ProductPageHero
        badge={t.page.badge}
        title={t.page.title}
        titleNode={
          <ScrambleText duration={2200} delay={150} chars={BLOCK_CHARS}>
            {t.page.title}
          </ScrambleText>
        }
        subtitle={t.page.subtitle}
      />

      {/* ── Merchant workflow selector ── */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <AgentConsole />
        </div>
      </section>

      {/* ── Live order ops + capabilities — dark ── */}
      <section className="border-y border-white/10 bg-white/[0.02] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl space-y-16">

          {/* Live ops per workflow */}
          <div>
            <p className="mb-8 text-[11px] font-bold uppercase tracking-[0.2em] text-[#F59E0B]">
              {t.eyebrow} · en vivo
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {agentList.map((agent) => {
                const steps = TRACE_STEPS[agent.id] ?? [];
                return (
                  <div
                    key={agent.id}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
                  >
                    <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      <span className="text-[11px] font-semibold text-slate-200">
                        {agent.name}
                      </span>
                      <span className="ml-auto text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-400">
                        {agent.status}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {steps.map((line, i) => (
                        <li key={i} className="flex items-baseline gap-3">
                          <span className="text-[10px] text-slate-600 select-none">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="text-[12px] font-medium text-slate-200">
                            {line.step}
                          </span>
                          <span className="ml-auto text-[11px] text-slate-500 shrink-0 text-right">
                            {line.detail}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Capabilities grid */}
          <div>
            <p className="mb-8 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Lo que incluye cada flujo
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {agentList.map((agent) => (
                <div
                  key={agent.id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
                >
                  <p className="mb-4 text-sm font-semibold text-white">{agent.name}</p>
                  <ul className="space-y-2.5">
                    {Object.values(agent.checks).map((check, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-px text-[11px] text-amber-500/80 select-none">›</span>
                        <span className="text-[12px] leading-5 text-slate-400">
                          {check}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Guardrail */}
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-5 py-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-[13px] leading-5 text-slate-300">{t.guardrail}</p>
          </div>

        </div>
      </section>

      {/* ── Automation — dark ── */}
      <section className="px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              {au.eyebrow}
            </p>
            <h2 className="text-4xl font-semibold tracking-[-0.055em] text-white sm:text-5xl">
              <ScrambleText duration={1800} delay={600} chars={BLOCK_CHARS}>
                {au.title}
              </ScrambleText>
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-400">{au.subtitle}</p>
          </div>
          <AutomationRecipe />
        </div>
      </section>

      <FinalCta />
      <Footer />
    </MarketingShell>
  );
}
