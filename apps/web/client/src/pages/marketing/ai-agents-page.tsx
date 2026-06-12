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
    <MarketingShell active="aiAgents">
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

      {/* ── Agent Console — dark ── */}
      <section className="bg-slate-950 px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <p className="mb-3 font-mono text-[11px] tracking-[0.18em] text-indigo-400 uppercase">
            agent.console
          </p>
          <AgentConsole />
        </div>
      </section>

      {/* ── Capabilities grid — dark ── */}
      <section className="border-t border-slate-800 bg-slate-950 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="mb-8 font-mono text-[11px] tracking-[0.18em] text-slate-500 uppercase">
            agent.capabilities[]
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {agentList.map((agent) => (
              <div
                key={agent.id}
                className="flex flex-col rounded-xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-mono text-[10px] tracking-widest text-indigo-400 uppercase">
                    {agent.id}
                  </span>
                  <span className="font-mono text-[10px] text-slate-600">{agent.status}</span>
                </div>
                <p className="mb-4 text-sm font-semibold leading-snug text-slate-100">
                  {agent.name}
                </p>
                <ul className="mt-auto space-y-2.5">
                  {Object.values(agent.checks).map((check, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-px font-mono text-indigo-500 select-none">›</span>
                      <span className="font-mono text-[11px] leading-5 text-slate-400">{check}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Guardrail banner */}
          <div className="mt-8 flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-900/60 px-5 py-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
            <p className="font-mono text-[11px] leading-5 text-slate-400">{t.guardrail}</p>
          </div>
        </div>
      </section>

      {/* ── Automation — light ── */}
      <section className="border-t border-slate-200 bg-white px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="mb-3 font-mono text-[11px] tracking-[0.18em] text-slate-400 uppercase">
              {au.eyebrow}
            </p>
            <h2 className="text-4xl font-semibold tracking-[-0.055em] text-slate-950 sm:text-5xl">
              <ScrambleText duration={1800} delay={600} chars={BLOCK_CHARS}>
                {au.title}
              </ScrambleText>
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-600">{au.subtitle}</p>
          </div>
          <AutomationRecipe />
        </div>
      </section>

      <FinalCta />
      <Footer />
    </MarketingShell>
  );
}
