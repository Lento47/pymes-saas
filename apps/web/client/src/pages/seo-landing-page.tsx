import { useEffect } from "react";
import { ArrowRight, CheckCircle2, MessageCircle, ShieldCheck, Workflow } from "lucide-react";
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

export const seoPages: Record<string, SeoPageConfig> = {
  "whatsapp-shared-inbox": {
    slug: "whatsapp-shared-inbox",
    eyebrow: "WhatsApp shared inbox",
    title: "WhatsApp shared inbox for SMB teams",
    description:
      "Centralize WhatsApp conversations, ownership, follow-ups, and customer context so growing teams can reply faster without losing the thread.",
    primaryKeyword: "WhatsApp shared inbox",
    bullets: ["Assign every WhatsApp conversation", "Track owners and next steps", "Keep customer history in one workspace"],
    sections: [
      {
        title: "One queue for customer conversations",
        body: "PymesHub helps teams stop working from disconnected phones and personal inboxes. Conversations become shared work with owners, due dates, and visibility for sales, service, and operations.",
      },
      {
        title: "Built for follow-through, not only replies",
        body: "Turn a WhatsApp message into a task, client update, invoice follow-up, or pipeline movement without copying context between tools.",
      },
    ],
    faqs: [
      {
        question: "What is a WhatsApp shared inbox?",
        answer:
          "It is a team inbox where multiple people can manage WhatsApp conversations with shared context, assignments, and follow-up workflows.",
      },
      {
        question: "Who should use it?",
        answer:
          "SMBs with sales, support, finance, or operations teams that receive customer requests through WhatsApp and need accountable handoffs.",
      },
    ],
    related: ["whatsapp-crm", "team-inbox", "workflow-automation"],
  },
  "crm-for-smbs": {
    slug: "crm-for-smbs",
    eyebrow: "CRM for SMBs",
    title: "CRM for SMBs that run on conversations, tasks, and invoices",
    description:
      "Manage clients, WhatsApp conversations, tasks, pipeline visibility, and invoices in one CRM workspace for growing SMB teams.",
    primaryKeyword: "CRM for SMBs",
    bullets: ["Unify client records", "Connect pipeline and invoices", "Give teams shared operational visibility"],
    sections: [
      {
        title: "A practical CRM for daily operations",
        body: "PymesHub keeps customer context close to the work: messages, notes, documents, tasks, deals, and billing follow-ups can live around the same client record.",
      },
      {
        title: "Designed around SMB execution",
        body: "Instead of forcing a heavy enterprise CRM rollout, teams can organize the operational moments that matter most: who owns the account, what is pending, and what needs to be collected.",
      },
    ],
    faqs: [
      {
        question: "How is PymesHub different from a generic CRM?",
        answer:
          "PymesHub positions the CRM around conversations, workflows, and invoicing, so customer operations stay connected to revenue follow-through.",
      },
      {
        question: "Can small teams use it before scaling?",
        answer:
          "Yes. The workspace is designed to make early teams more organized while leaving room for roles, permissions, and repeatable processes.",
      },
    ],
    related: ["client-management", "whatsapp-crm", "invoicing"],
  },
  "client-management": {
    slug: "client-management",
    eyebrow: "Client management",
    title: "Client management software for SMB operations",
    description:
      "Keep client conversations, documents, tasks, invoices, and pipeline updates connected in one operating workspace for growing teams.",
    primaryKeyword: "client management software",
    bullets: ["See customer context quickly", "Coordinate sales and service", "Attach tasks and follow-ups to clients"],
    sections: [
      {
        title: "Client context your team can trust",
        body: "Customer work gets harder when every update lives in a different inbox, spreadsheet, or billing tool. PymesHub gives teams a shared place to understand the client and move work forward.",
      },
      {
        title: "From first message to long-term account",
        body: "Capture important conversations, assign next steps, track documents, and keep invoice follow-ups connected to the same operational history.",
      },
    ],
    faqs: [
      {
        question: "What should client management software include?",
        answer:
          "For SMBs, it should connect contact records, conversation history, tasks, documents, revenue status, and clear ownership.",
      },
      {
        question: "Does this replace spreadsheets?",
        answer:
          "It can replace the operational spreadsheets teams use to track clients, follow-ups, and handoffs when those spreadsheets become hard to keep current.",
      },
    ],
    related: ["crm-for-smbs", "team-inbox", "workflow-automation"],
  },
  "workflow-automation": {
    slug: "workflow-automation",
    eyebrow: "Workflow automation",
    title: "Workflow automation for SMB customer operations",
    description:
      "Automate reminders, handoffs, client follow-ups, and invoice next steps from one workspace connected to conversations and pipeline activity.",
    primaryKeyword: "workflow automation for SMBs",
    bullets: ["Trigger reminders from real work", "Reduce manual handoffs", "Keep teams aligned on next steps"],
    sections: [
      {
        title: "Automations tied to customer context",
        body: "PymesHub focuses workflow automation on practical operational moments: new messages, pending proposals, overdue replies, invoice follow-ups, and internal ownership changes.",
      },
      {
        title: "Less tool switching, more execution",
        body: "Teams can standardize follow-through without depending on memory, chat pings, or disconnected task lists.",
      },
    ],
    faqs: [
      {
        question: "What workflows can SMBs automate first?",
        answer:
          "Start with lead assignment, reply reminders, proposal follow-ups, invoice collection reminders, and escalation paths for high-priority clients.",
      },
      {
        question: "Is workflow automation only for large companies?",
        answer:
          "No. SMBs often benefit fastest because a few repeatable rules can remove many manual follow-ups from daily operations.",
      },
    ],
    related: ["whatsapp-shared-inbox", "team-inbox", "invoicing"],
  },
  "whatsapp-crm": {
    slug: "whatsapp-crm",
    eyebrow: "WhatsApp CRM",
    title: "WhatsApp CRM for growing SMBs in LATAM",
    description:
      "Connect WhatsApp conversations to client records, sales pipeline, tasks, and invoice follow-ups in one CRM workspace.",
    primaryKeyword: "WhatsApp CRM",
    bullets: ["Link chats to clients", "Track revenue follow-ups", "Give teams a shared source of truth"],
    sections: [
      {
        title: "A CRM built around how customers actually write",
        body: "Many SMBs live in WhatsApp. PymesHub turns those customer conversations into structured operational context for sales, service, finance, and leadership.",
      },
      {
        title: "Make WhatsApp actionable",
        body: "Instead of only answering messages, teams can assign ownership, update client records, create tasks, and keep invoice or pipeline next steps visible.",
      },
    ],
    faqs: [
      {
        question: "Why combine WhatsApp and CRM?",
        answer:
          "Because customer intent, objections, documents, payment questions, and support requests often start in WhatsApp and need to become accountable work.",
      },
      {
        question: "Is this useful beyond sales?",
        answer:
          "Yes. Support, finance, operations, and leadership all benefit when WhatsApp context is connected to clients and workflows.",
      },
    ],
    related: ["whatsapp-shared-inbox", "crm-for-smbs", "client-management"],
  },
  invoicing: {
    slug: "invoicing",
    eyebrow: "Invoicing workflows",
    title: "Invoicing workflows connected to clients and conversations",
    description:
      "Keep invoice follow-ups, customer conversations, documents, and pipeline context together so SMB teams can collect with less operational friction.",
    primaryKeyword: "invoicing workflows",
    bullets: ["Connect billing to client context", "Track payment follow-ups", "Keep finance and sales aligned"],
    sections: [
      {
        title: "Invoices should not live outside the customer story",
        body: "PymesHub keeps billing follow-through close to conversations, documents, tasks, and pipeline status so teams can understand what is blocking payment.",
      },
      {
        title: "Operational visibility for collections",
        body: "Finance and customer-facing teams can coordinate next steps without losing context in separate spreadsheets or chat threads.",
      },
    ],
    faqs: [
      {
        question: "Why connect invoicing with CRM workflows?",
        answer:
          "Because payment questions, approvals, documents, and customer commitments often sit across sales, service, and finance conversations.",
      },
      {
        question: "Who benefits from invoicing workflows?",
        answer:
          "SMB teams that need shared visibility into issued invoices, follow-up ownership, and customer context benefit most.",
      },
    ],
    related: ["crm-for-smbs", "workflow-automation", "client-management"],
  },
  "team-inbox": {
    slug: "team-inbox",
    eyebrow: "Team inbox",
    title: "Team inbox for sales, support, finance, and operations",
    description:
      "Bring shared customer conversations, assignments, tasks, and follow-ups into one team inbox built for SMB operations.",
    primaryKeyword: "team inbox",
    bullets: ["Route requests to the right owner", "Make handoffs visible", "Coordinate multiple teams around one customer thread"],
    sections: [
      {
        title: "A shared inbox for more than support",
        body: "PymesHub gives sales, service, finance, and operations teams a common place to manage customer work that starts in conversations and ends in follow-through.",
      },
      {
        title: "Know what is open, owned, or overdue",
        body: "A team inbox becomes operational when every conversation can have an owner, next step, status, and related client context.",
      },
    ],
    faqs: [
      {
        question: "What is a team inbox?",
        answer:
          "A team inbox lets multiple users manage shared customer conversations with ownership, visibility, and response coordination.",
      },
      {
        question: "How does it help SMB teams?",
        answer:
          "It reduces missed replies, unclear ownership, and fragmented customer context across departments.",
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
          buildSoftwareSchema(`/${config.slug}`, config.title, config.description),
          createFaqSchema(config),
        ],
      },
    });
  }, [config]);

  if (!config) return null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05091d] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,110,247,0.22),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(223,255,74,0.10),transparent_30%)]" />
      </div>

      <main className="relative z-10">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 md:px-8">
          <Link href="/">
            <a aria-label="PymesHub home"><BrandLockup compact /></a>
          </Link>
          <div className="flex items-center gap-2 md:gap-4">
            <LanguageSwitcher variant="marketing" />
            <Link href="/pricing">
              <a className="font-marketing rounded-full border border-white/12 px-4 py-2 text-sm text-white/78 transition hover:border-white/24 hover:text-white">
                Pricing
              </a>
            </Link>
          </div>
        </nav>

        <section className="px-4 py-14 md:px-8 md:py-20">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.04fr_0.96fr] lg:items-center">
            <article>
              <p className="font-marketing text-sm font-semibold uppercase tracking-[0.36em] text-[#dfff4a]/72">
                {config.eyebrow}
              </p>
              <h1 className="font-marketing mt-5 text-4xl font-semibold tracking-[-0.05em] md:text-6xl">
                {config.title}
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#c9d0f5]/74">
                {config.description}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/register">
                  <a className="inline-flex items-center justify-center gap-2 rounded-full bg-[#dfff4a] px-6 py-3 font-marketing text-sm font-semibold text-[#07101f] transition hover:translate-y-[-1px]">
                    Start a workspace <ArrowRight className="h-4 w-4" />
                  </a>
                </Link>
                <Link href="/">
                  <a className="inline-flex items-center justify-center rounded-full border border-white/12 px-6 py-3 font-marketing text-sm font-semibold text-white/78 transition hover:border-white/24 hover:text-white">
                    Explore PymesHub
                  </a>
                </Link>
              </div>
            </article>

            <aside className="glass-panel rounded-[32px] p-6 md:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#dfff4a]/10 text-[#dfff4a]">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-marketing text-xs uppercase tracking-[0.24em] text-white/42">Primary keyword</p>
                  <h2 className="font-marketing text-2xl font-semibold tracking-[-0.03em]">{config.primaryKeyword}</h2>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                {config.bullets.map((bullet) => (
                  <div key={bullet} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[#dfff4a]" />
                    <span className="text-sm text-[#d7ddff]/78">{bullet}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="px-4 pb-20 md:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
            {config.sections.map((section, index) => (
              <article key={section.title} className="glass-panel rounded-[28px] p-6 md:p-8">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06] text-white/72">
                  {index === 0 ? <Workflow className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                </div>
                <h2 className="font-marketing text-2xl font-semibold tracking-[-0.03em]">{section.title}</h2>
                <p className="mt-4 text-sm leading-7 text-[#bcc5ee]/72">{section.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="px-4 pb-20 md:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <p className="font-marketing text-sm font-semibold uppercase tracking-[0.32em] text-[#dfff4a]/68">FAQ</p>
              <h2 className="font-marketing mt-3 text-3xl font-semibold tracking-[-0.04em]">Common questions about {config.primaryKeyword}</h2>
            </div>
            <div className="mt-8 grid gap-4">
              {config.faqs.map((faq) => (
                <article key={faq.question} className="glass-panel rounded-2xl p-6">
                  <h3 className="font-marketing text-lg font-semibold text-white/90">{faq.question}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#bcc5ee]/72">{faq.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 px-4 py-10 md:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="font-marketing text-sm uppercase tracking-[0.26em] text-white/38">Related PymesHub pages</p>
            <div className="flex flex-wrap gap-3">
              {config.related.map((relatedSlug) => (
                <Link key={relatedSlug} href={`/${relatedSlug}`}>
                  <a className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:border-[#dfff4a]/40 hover:text-white">
                    {seoPages[relatedSlug]?.primaryKeyword ?? relatedSlug}
                  </a>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
