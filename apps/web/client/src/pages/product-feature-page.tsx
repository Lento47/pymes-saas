import { ElementType } from "react";
import { motion } from "framer-motion";
import { Link, Redirect } from "wouter";
import {
  ArrowRight, CheckCircle2,
  // inbox pains
  MessageSquareX, GitBranch, Clock,
  // inbox features
  Inbox, UserCheck, Bot, History,
  // crm pains
  Sheet, BookX, Bell,
  // crm features
  Contact, RefreshCw, Tag, KanbanSquare,
  // tasks pains
  ListX, EyeOff, Hourglass,
  // tasks features
  MessageSquarePlus, ClipboardList, CalendarClock, LayoutDashboard,
  // documents pains
  MessagesSquare, FileClock, BookOpen,
  // documents features
  PenSquare, FolderOpen, Search, ShieldCheck,
  // billing pains
  Laptop2, CircleAlert, TimerOff,
  // billing features
  Receipt, Send, BadgeCheck, LineChart,
  // automations pains
  Repeat2, MoonStar, Brain,
  // automations features
  Zap, MessageSquareText, GitFork, BellRing,
  // analytics pains
  BarChartHorizontalBig, Target, FileEdit,
  // analytics features
  AreaChart, BarChart3, TrendingUp, Download,
} from "lucide-react";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { Footer } from "@/components/marketing/footer";
import { useI18n } from "@/components/providers/i18n-provider";

const ACCENT = "#6757E8";
const BG = "#F7F8FC";
const BORDER = "#E6E8EF";

interface FeatureIcons {
  pains: [ElementType, ElementType, ElementType];
  features: [ElementType, ElementType, ElementType, ElementType];
}

const FEATURE_ICONS: Record<string, FeatureIcons> = {
  inbox: {
    pains: [MessageSquareX, GitBranch, Clock],
    features: [Inbox, UserCheck, Bot, History],
  },
  crm: {
    pains: [Sheet, BookX, Bell],
    features: [Contact, RefreshCw, Tag, KanbanSquare],
  },
  tasks: {
    pains: [ListX, EyeOff, Hourglass],
    features: [MessageSquarePlus, ClipboardList, CalendarClock, LayoutDashboard],
  },
  documents: {
    pains: [MessagesSquare, FileClock, BookOpen],
    features: [PenSquare, FolderOpen, Search, ShieldCheck],
  },
  billing: {
    pains: [Laptop2, CircleAlert, TimerOff],
    features: [Receipt, Send, BadgeCheck, LineChart],
  },
  automations: {
    pains: [Repeat2, MoonStar, Brain],
    features: [Zap, MessageSquareText, GitFork, BellRing],
  },
  analytics: {
    pains: [BarChartHorizontalBig, Target, FileEdit],
    features: [AreaChart, BarChart3, TrendingUp, Download],
  },
};

export default function ProductFeaturePage({ slug }: { slug: string }) {
  const { messages } = useI18n();
  const pf = (messages as any).productFeatures;
  const copy = pf?.[slug];
  const icons = FEATURE_ICONS[slug];

  if (!copy || !icons) return <Redirect to="/" />;

  const pains = [
    { icon: icons.pains[0], title: copy.pain1Title, text: copy.pain1Text },
    { icon: icons.pains[1], title: copy.pain2Title, text: copy.pain2Text },
    { icon: icons.pains[2], title: copy.pain3Title, text: copy.pain3Text },
  ];

  const features = [
    { icon: icons.features[0], title: copy.feat1Title, text: copy.feat1Text },
    { icon: icons.features[1], title: copy.feat2Title, text: copy.feat2Text },
    { icon: icons.features[2], title: copy.feat3Title, text: copy.feat3Text },
    { icon: icons.features[3], title: copy.feat4Title, text: copy.feat4Text },
  ];

  return (
    <div className="min-h-screen" style={{ background: BG }}>
      {/* Nav */}
      <header className="border-b bg-white px-4 py-4 md:px-8" style={{ borderColor: BORDER }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/"><BrandLockup compact /></Link>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-gray-500 hover:text-gray-900 transition">{pf.seePricing}</Link>
            <Link
              href="/register"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: ACCENT }}
            >
              {pf.startFree}
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
          {copy.eyebrow}
        </span>
        <h1 className="font-marketing text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl mb-6 max-w-2xl mx-auto">
          {copy.headline}
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto mb-10 leading-relaxed">
          {copy.subtext}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: ACCENT }}
          >
            {pf.startFree}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/#demo"
            className="inline-flex items-center gap-2 rounded-xl border px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            style={{ borderColor: BORDER }}
          >
            {pf.seeDemo}
          </Link>
        </div>
      </section>

      {/* Pain points */}
      <section className="mx-auto max-w-5xl px-4 pb-16 md:px-8">
        <p className="text-center text-sm font-semibold uppercase tracking-wider text-gray-400 mb-8">
          {pf.painLabel}
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
            {pf.solutionLabel}
          </p>
          {pf.solutionSubtitle && (
            <h2 className="font-marketing text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              {pf.solutionSubtitle}
            </h2>
          )}
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
        <div className="rounded-2xl border bg-white p-8 text-center" style={{ borderColor: BORDER }}>
          <div className="flex justify-center mb-5">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className="h-4 w-4 text-amber-400 fill-current" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <blockquote className="text-base text-gray-700 leading-relaxed mb-4 italic">
            "{copy.quote}"
          </blockquote>
          <p className="text-xs text-gray-400">{copy.quoteAuthor}</p>
        </div>
      </section>

      {/* Included checklist */}
      <section className="mx-auto max-w-5xl px-4 py-12 md:px-8">
        <div className="rounded-2xl border bg-white px-8 py-10" style={{ borderColor: BORDER }}>
          <h3 className="font-marketing text-base font-semibold text-gray-900 mb-6 text-center">
            {pf.includedTitle}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {(pf.includedItems as string[]).map((item: string) => (
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
          style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, #8B5CF6 100%)` }}
        >
          <h2 className="font-marketing text-2xl font-bold tracking-tight sm:text-3xl mb-6 max-w-xl mx-auto">
            {copy.ctaHeadline}
          </h2>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3 text-sm font-semibold transition hover:opacity-90"
            style={{ color: ACCENT }}
          >
            {pf.startFree}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
