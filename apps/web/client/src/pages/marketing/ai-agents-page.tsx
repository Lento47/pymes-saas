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

// Fake but realistic agent trace log shown per agent
const TRACES: Record<string, { fn: string; result: string }[]> = {
  reception: [
    { fn: "classify_intent(message)",      result: '"consulta_facturacion"'   },
    { fn: "check_business_hours()",        result: "open: true"               },
    { fn: "requires_human_handoff()",      result: "false"                    },
    { fn: "prepare_response(template)",    result: "draft ready"              },
    { fn: "escalate_if_needed(0.85)",      result: "confidence: 0.97"         },
  ],
  sales: [
    { fn: "detect_buying_intent(message)", result: '"alta"'                   },
    { fn: "lookup_customer_history(id)",   result: "2 prev interactions"      },
    { fn: "create_followup_task()",        result: "task_id: T-4821"          },
    { fn: "suggest_template(intent)",      result: "template: sales_v3"       },
    { fn: "requires_approval()",          result: "true → pending review"    },
  ],
  support: [
    { fn: "read_knowledge_base(query)",    result: "3 articles found"         },
    { fn: "summarize_context(thread)",     result: "298 tokens"               },
    { fn: "confidence_score()",            result: "0.61 → below threshold"   },
    { fn: "escalate_to_human(reason)",     result: "low_confidence"           },
    { fn: "prepare_handoff_summary()",     result: "ready"                    },
  ],
  billing: [
    { fn: "extract_invoice_fields(msg)",   result: "missing: [amount, date]"  },
    { fn: "request_missing_data(fields)",  result: "2 fields requested"       },
    { fn: "prepare_draft(data)",           result: "draft_id: D-9043"         },
    { fn: "requires_user_review()",        result: "true → blocked"           },
    { fn: "notify_team(draft_id)",         result: "notification sent"        },
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

      {/* ── Agent Console — light, as designed ── */}
      <section className="bg-slate-50 px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <AgentConsole />
        </div>
      </section>

      {/* ── Agent trace + capabilities — dark ── */}
      <section className="bg-slate-950 px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl space-y-16">

          {/* Trace logs */}
          <div>
            <p className="mb-8 font-mono text-[11px] tracking-[0.2em] text-slate-500 uppercase">
              agent.trace_log[]
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {agentList.map((agent) => {
                const trace = TRACES[agent.id] ?? [];
                return (
                  <div
                    key={agent.id}
                    className="rounded-xl border border-slate-800 bg-slate-900 p-5"
                  >
                    <div className="mb-4 flex items-center gap-2 border-b border-slate-800 pb-3">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="font-mono text-[11px] text-slate-300">
                        agent/{agent.id}
                      </span>
                      <span className="ml-auto font-mono text-[10px] text-indigo-400">
                        {agent.status}
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {trace.map((line, i) => (
                        <li key={i} className="flex items-baseline gap-3">
                          <span className="font-mono text-[10px] text-slate-600 select-none">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="font-mono text-[11px] text-indigo-300">
                            {line.fn}
                          </span>
                          <span className="ml-auto font-mono text-[11px] text-slate-500 shrink-0">
                            {line.result}
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
            <p className="mb-8 font-mono text-[11px] tracking-[0.2em] text-slate-500 uppercase">
              agent.capabilities[]
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {agentList.map((agent) => (
                <div
                  key={agent.id}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-5"
                >
                  <p className="mb-4 text-sm font-semibold text-slate-100">{agent.name}</p>
                  <ul className="space-y-2.5">
                    {Object.values(agent.checks).map((check, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-px font-mono text-[11px] text-indigo-500 select-none">›</span>
                        <span className="font-mono text-[11px] leading-5 text-slate-400">
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
          <div className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-900/60 px-5 py-4">
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
