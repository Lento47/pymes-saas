import { useState } from "react";
type LucideIcon = any;
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  ChartSpline,
  ChevronDown,
  FileText,
  Globe2,
  LifeBuoy,
  LockKeyhole,
  Menu,
  MessageSquareText,
  ShieldCheck,
  Workflow,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { useI18n } from "@/components/providers/i18n-provider";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { cn } from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const navItems = [
  { id: "platform", key: "platform" },
  { id: "workflows", key: "workflows" },
  { id: "insights", key: "insights" },
  { id: "security", key: "security" },
] as const;

type NavKey = (typeof navItems)[number]["key"];

interface MarketingMenuLink {
  description: string;
  href: string;
  icon: LucideIcon;
  title: string;
}

function MarketingMenuAction({
  description,
  featured = false,
  href,
  icon: Icon,
  onNavigate,
  title,
}: MarketingMenuLink & {
  featured?: boolean;
  onNavigate: (href: string) => void;
}) {
  const classes = cn(
    "group block rounded-md px-4 py-3 text-left transition-colors duration-150",
    featured
      ? "border border-border bg-muted/35 hover:bg-muted/55"
      : "hover:bg-muted/35"
  );

  const content = (
    <>
      <div className="flex items-start gap-3">
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
          featured
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground group-hover:text-foreground"
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="font-marketing text-sm font-semibold tracking-[-0.01em] text-foreground">
            {title}
          </h3>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
    </>
  );

  if (href.startsWith("#")) {
    return (
      <button type="button" onClick={() => onNavigate(href)} className={classes}>
        {content}
      </button>
    );
  }

  return (
    <Link href={href} onClick={() => onNavigate(href)} className={classes}>
      {content}
    </Link>
  );
}

function PerformanceChart({ labels }: { labels: readonly string[] }) {
  return (
    <svg viewBox="0 0 460 260" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="request-line" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
        <linearGradient id="request-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(37,99,235,0.16)" />
          <stop offset="100%" stopColor="rgba(37,99,235,0.02)" />
        </linearGradient>
        <filter id="request-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {[0, 1, 2, 3, 4, 5].map((index) => (
        <line
          key={`h-${index}`}
          x1="48"
          x2="420"
          y1={48 + index * 34}
          y2={48 + index * 34}
          stroke="rgba(124, 139, 255, 0.14)"
          strokeWidth="1"
        />
      ))}

      {[0, 1, 2, 3, 4, 5].map((index) => (
        <line
          key={`v-${index}`}
          x1={48 + index * 74}
          x2={48 + index * 74}
          y1="48"
          y2="218"
          stroke="rgba(124, 139, 255, 0.12)"
          strokeWidth="1"
        />
      ))}

      <path
        d="M48 197C74 185 84 166 112 168C136 170 150 176 176 150C193 132 210 136 232 118C252 101 269 97 288 126C304 149 329 146 351 130C367 118 382 122 401 110C414 102 420 92 420 92V218H48Z"
        fill="url(#request-area)"
      />
      <path
        d="M48 197C74 185 84 166 112 168C136 170 150 176 176 150C193 132 210 136 232 118C252 101 269 97 288 126C304 149 329 146 351 130C367 118 382 122 401 110C414 102 420 92 420 92"
        fill="none"
        stroke="url(#request-line)"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {labels.map((label, index) => (
        <text
          key={label}
          x={48 + index * 74}
          y="242"
          fill="rgba(208,216,255,0.58)"
          fontSize="12"
          fontFamily="Manrope, sans-serif"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

function OrbitGraphic() {
  return (
    <div className="app-panel relative mx-auto mt-8 h-56 w-56 rounded-lg p-5">
      <div className="grid h-full grid-cols-2 gap-3">
        {["Bandeja", "Facturas", "Tareas", "Pipeline"].map((label) => (
          <div key={label} className="rounded-md border border-border-subtle bg-muted/20 p-3">
            <span className="mb-3 block h-2 w-8 rounded-full bg-primary/45" />
            <p className="font-marketing text-xs font-semibold text-foreground">{label}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Operativo</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Landing() {
  const { messages } = useI18n();
  const copy = messages.landing;
  const [activeMenu, setActiveMenu] = useState<NavKey | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const productCards: Array<{
    assetSrc?: string;
    icon: LucideIcon;
    title: string;
    description: string;
    bullets: readonly string[];
  }> = [
    {
      icon: ShieldCheck,
      assetSrc: "/landing-icons/enterprise-workspace-control.png",
      ...copy.platform.cards[0],
    },
    { icon: Workflow, ...copy.platform.cards[1] },
    { icon: BookOpen, ...copy.platform.cards[2] },
  ];

  const dropdownMenus: Record<
    NavKey,
    {
      description: string;
      eyebrow: string;
      featured: MarketingMenuLink;
      links: MarketingMenuLink[];
      title: string;
    }
  > = {
    platform: {
      eyebrow: copy.menus.platform.eyebrow,
      title: copy.menus.platform.title,
      description: copy.menus.platform.description,
      featured: {
        title: copy.menus.platform.featuredTitle,
        description: copy.menus.platform.featuredDescription,
        href: "/platform",
        icon: ShieldCheck,
      },
      links: [
        {
          title: copy.menus.platform.links[0].title,
          description: copy.menus.platform.links[0].description,
          href: "/security",
          icon: LockKeyhole,
        },
        {
          title: copy.menus.platform.links[1].title,
          description: copy.menus.platform.links[1].description,
          href: "/documentation/trust-center-overview",
          icon: ShieldCheck,
        },
        {
          title: copy.menus.platform.links[2].title,
          description: copy.menus.platform.links[2].description,
          href: "/documentation",
          icon: BookOpen,
        },
      ],
    },
    workflows: {
      eyebrow: copy.menus.workflows.eyebrow,
      title: copy.menus.workflows.title,
      description: copy.menus.workflows.description,
      featured: {
        title: copy.menus.workflows.featuredTitle,
        description: copy.menus.workflows.featuredDescription,
        href: "/workflows",
        icon: Workflow,
      },
      links: [
        {
          title: copy.menus.workflows.links[0].title,
          description: copy.menus.workflows.links[0].description,
          href: "/workflows",
          icon: Workflow,
        },
        {
          title: copy.menus.workflows.links[1].title,
          description: copy.menus.workflows.links[1].description,
          href: "/documentation/workspace-launch-guide",
          icon: FileText,
        },
        {
          title: copy.menus.workflows.links[2].title,
          description: copy.menus.workflows.links[2].description,
          href: "/documentation/support-policy",
          icon: LifeBuoy,
        },
      ],
    },
    insights: {
      eyebrow: copy.menus.insights.eyebrow,
      title: copy.menus.insights.title,
      description: copy.menus.insights.description,
      featured: {
        title: copy.menus.insights.featuredTitle,
        description: copy.menus.insights.featuredDescription,
        href: "/insights",
        icon: ChartSpline,
      },
      links: [
        {
          title: copy.menus.insights.links[0].title,
          description: copy.menus.insights.links[0].description,
          href: "/insights",
          icon: ChartSpline,
        },
        {
          title: copy.menus.insights.links[1].title,
          description: copy.menus.insights.links[1].description,
          href: "/documentation/sla",
          icon: BookOpen,
        },
        {
          title: copy.menus.insights.links[2].title,
          description: copy.menus.insights.links[2].description,
          href: "/documentation/support-policy",
          icon: LifeBuoy,
        },
      ],
    },
    security: {
      eyebrow: copy.menus.security.eyebrow,
      title: copy.menus.security.title,
      description: copy.menus.security.description,
      featured: {
        title: copy.menus.security.featuredTitle,
        description: copy.menus.security.featuredDescription,
        href: "/security",
        icon: ShieldCheck,
      },
      links: [
        {
          title: copy.menus.security.links[0].title,
          description: copy.menus.security.links[0].description,
          href: "/security",
          icon: LockKeyhole,
        },
        {
          title: copy.menus.security.links[1].title,
          description: copy.menus.security.links[1].description,
          href: "/legal",
          icon: FileText,
        },
        {
          title: copy.menus.security.links[2].title,
          description: copy.menus.security.links[2].description,
          href: "/documentation/trust-center-overview",
          icon: BookOpen,
        },
      ],
    },
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      setTimeout(() => {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  };

  const handleMenuNavigate = (href: string) => {
    setActiveMenu(null);

    if (href.startsWith("#")) {
      scrollToSection(href.slice(1));
    }
  };

  const handleNavClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Don't close if clicking inside the dropdown menu
    if (target.closest('[data-nav-dropdown]')) {
      return;
    }
    // Don't close if clicking on nav buttons - they handle their own state
    if (target.closest('[data-nav-button]')) {
      return;
    }
    // Don't close if clicking inside mobile menu
    if (target.closest('[data-mobile-menu]')) {
      return;
    }
    // Close menu if clicking outside nav area
    if (activeMenu) {
      setActiveMenu(null);
    }
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  };

  const handleNavTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Don't close if touching inside the dropdown menu
    if (target.closest('[data-nav-dropdown]')) {
      return;
    }
    // Don't close if touching on nav buttons - they handle their own state
    if (target.closest('[data-nav-button]')) {
      return;
    }
    // Don't close if touching inside mobile menu
    if (target.closest('[data-mobile-menu]')) {
      return;
    }
    // Close menu if touching outside nav area
    if (activeMenu) {
      setActiveMenu(null);
    }
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className="relative overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-border" />

      <main className="relative z-10">
        <section className="px-4 pb-16 pt-6 md:px-8 md:pb-24">
          <div className="mx-auto max-w-7xl">
            <div
              className="relative"
              onClick={handleNavClick}
              onTouchEnd={handleNavTouchEnd}
            >
              <nav
                className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4 md:px-7"
                data-nav-item
              >
                <BrandLockup compact />

                <div className="hidden items-center gap-8 lg:flex">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      data-nav-button
                      onClick={() =>
                        setActiveMenu((current) => (current === item.key ? null : item.key))
                      }
                      className="font-marketing text-sm font-medium text-muted-foreground transition hover:text-foreground"
                    >
                      {copy.nav[item.key]}
                      <ChevronDown
                        className={cn(
                          "ml-1 inline h-4 w-4 text-muted-foreground transition",
                          activeMenu === item.key && "rotate-180 text-foreground"
                        )}
                      />
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 md:gap-4 flex-shrink-0">
                  <div className="hidden sm:flex items-center gap-2 md:gap-4">
                    <LanguageSwitcher variant="marketing" />
                  </div>
                  <div className="hidden md:flex items-center gap-4">
                    <Link href="/pricing" className="font-marketing text-sm font-medium text-muted-foreground transition hover:text-foreground">
                        {copy.nav.pricing}
                    </Link>
                    <Link href="/documentation" className="font-marketing text-sm font-medium text-muted-foreground transition hover:text-foreground">
                        {copy.nav.documentation}
                    </Link>
                  </div>
                  <Link href="/login" className="font-marketing hidden sm:block text-sm font-medium text-muted-foreground transition hover:text-foreground">
                    {copy.nav.logIn}
                  </Link>
                  <Link href="/login" className="font-marketing hidden items-center gap-1 whitespace-nowrap rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 sm:inline-flex sm:gap-2 sm:px-4 sm:py-3 sm:text-sm md:px-6">
                    {copy.nav.getStarted}
                    <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="md:hidden text-muted-foreground transition hover:text-foreground flex-shrink-0"
                  >
                    {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  </button>
                </div>
              </nav>

              {mobileMenuOpen && (
                <div className="md:hidden mt-2 rounded-lg border border-border bg-card p-4" data-mobile-menu>
                  <div className="space-y-2">
                    <Link href="/pricing" className="block w-full rounded-lg px-4 py-3 text-left font-marketing text-sm font-medium text-muted-foreground transition hover:bg-muted/35 hover:text-foreground">
                        {copy.nav.pricing}
                    </Link>
                    <Link href="/documentation" className="block w-full rounded-lg px-4 py-3 text-left font-marketing text-sm font-medium text-muted-foreground transition hover:bg-muted/35 hover:text-foreground">
                        {copy.nav.documentation}
                    </Link>
                    <Link href="/login" className="block w-full rounded-lg px-4 py-3 text-left font-marketing text-sm font-medium text-muted-foreground transition hover:bg-muted/35 hover:text-foreground">
                        {copy.nav.logIn}
                    </Link>
                    <Link href="/login" className="font-marketing block w-full rounded-md bg-primary px-3 py-2 text-center text-xs font-semibold text-primary-foreground transition hover:bg-primary/90">
                        {copy.nav.getStarted}
                        <ArrowRight className="h-3 w-3 inline" />
                    </Link>
                  </div>
                </div>
              )}

              {activeMenu && (
                <div
                  className="absolute inset-x-0 top-full z-20 pt-4 pointer-events-auto"
                  data-nav-dropdown
                >
                  <div className="rounded-lg border border-border bg-card">
                    {/* Header row */}
                    <div className="flex items-center justify-between px-6 pt-5 pb-2">
                      <div>
                        <p className="font-marketing text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {dropdownMenus[activeMenu].eyebrow}
                        </p>
                        <h2 className="font-marketing mt-1 text-xl font-semibold tracking-[-0.02em] text-foreground">
                          {dropdownMenus[activeMenu].title}
                        </h2>
                      </div>
                    </div>

                    <div className="grid gap-3 p-4 pt-2 lg:grid-cols-[1fr_1.5fr]">
                      {/* Left: featured */}
                      <div>
                        <p className="font-marketing px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {copy.menus[activeMenu].featuredLabel}
                        </p>
                        <MarketingMenuAction
                          {...dropdownMenus[activeMenu].featured}
                          featured
                          onNavigate={handleMenuNavigate}
                        />
                      </div>

                      {/* Right: link list */}
                      <div className="space-y-1">
                        {dropdownMenus[activeMenu].links.map((item) => (
                          <MarketingMenuAction
                            key={`${activeMenu}-${item.title}`}
                            {...item}
                            onNavigate={handleMenuNavigate}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mx-auto max-w-4xl pt-16 text-center md:pt-16">
              <p className="font-marketing text-sm font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                {copy.platform.eyebrow}
              </p>
              <h1 className="font-marketing mt-5 text-5xl font-semibold leading-[0.98] tracking-[-0.05em] text-foreground sm:text-6xl md:text-[5rem]">
                {copy.platform.title}
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
                {copy.platform.description}
              </p>
            </div>
          </div>
        </section>

        <section id="platform" className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="font-marketing text-sm font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                {copy.platform.eyebrow}
              </p>
              <h2 className="font-marketing mt-5 text-4xl font-semibold tracking-[-0.04em] text-foreground md:text-6xl">
                {copy.platform.title}
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
                {copy.platform.description}
              </p>
            </div>

            {/* Mobile Carousel */}
            <div className="md:hidden mt-14">
              <Carousel opts={{ align: "start", loop: true }}>
                <CarouselContent>
                  {productCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <CarouselItem key={card.title} className="basis-full">
                        <article className="app-panel rounded-lg p-7">
                          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 p-2 text-primary">
                            {card.assetSrc ? (
                              <img
                                src={card.assetSrc}
                                alt=""
                                className="h-full w-full object-contain"
                                aria-hidden="true"
                              />
                            ) : (
                              <Icon className="h-6 w-6" />
                            )}
                          </div>
                          <h3 className="font-marketing mt-7 text-2xl font-semibold tracking-[-0.03em]">
                            {card.title}
                          </h3>
                          <p className="mt-4 text-sm leading-7 text-muted-foreground">
                            {card.description}
                          </p>
                          <ul className="mt-8 space-y-3 text-sm leading-7 text-muted-foreground">
                            {card.bullets.map((bullet) => (
                              <li key={bullet} className="flex gap-3">
                                <span className="mt-2 h-2.5 w-2.5 rounded-full bg-primary/50" />
                                <span>{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        </article>
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>
                <div className="flex justify-center gap-2 mt-4">
                  <CarouselPrevious className="relative position-static mx-0" />
                  <CarouselNext className="relative position-static mx-0" />
                </div>
              </Carousel>
            </div>

            {/* Desktop Grid */}
            <div className="hidden md:grid mt-14 grid gap-6 lg:grid-cols-3">
              {productCards.map((card) => {
                const Icon = card.icon;
                return (
                  <article key={card.title} className="app-panel rounded-lg p-7">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 p-2 text-primary">
                      {card.assetSrc ? (
                        <img
                          src={card.assetSrc}
                          alt=""
                          className="h-full w-full object-contain"
                          aria-hidden="true"
                        />
                      ) : (
                        <Icon className="h-6 w-6" />
                      )}
                    </div>
                    <h3 className="font-marketing mt-7 text-2xl font-semibold tracking-[-0.03em]">
                      {card.title}
                    </h3>
                    <p className="mt-4 text-sm leading-7 text-muted-foreground">
                      {card.description}
                    </p>
                    <ul className="mt-8 space-y-3 text-sm leading-7 text-muted-foreground">
                      {card.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-3">
                          <span className="mt-2 h-2.5 w-2.5 rounded-full bg-primary/50" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="workflows" className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.08fr_0.92fr]">
            <article className="app-panel rounded-lg p-8 md:p-10">
              <p className="font-marketing text-sm font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                {copy.workflows.eyebrow}
              </p>
              <h2 className="font-marketing mt-5 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
                {copy.workflows.title}
              </h2>
              <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground">
                {copy.workflows.description}
              </p>

              <div className="mt-10 grid gap-5 md:grid-cols-2">
                {[
                  { icon: Workflow, ...copy.workflows.features[0] },
                  { icon: MessageSquareText, ...copy.workflows.features[1] },
                  { icon: ChartSpline, ...copy.workflows.features[2] },
                  { icon: Globe2, ...copy.workflows.features[3] },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="rounded-md border border-border bg-muted/20 p-5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="font-marketing mt-5 text-xl font-semibold tracking-[-0.03em]">
                        {item.title}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-muted-foreground">
                        {item.body}
                      </p>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="app-panel rounded-lg p-6 md:p-8">
              <div className="rounded-lg border border-border bg-muted/20 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-marketing text-sm font-semibold uppercase tracking-[0.3em] text-[#aeb6df]/52">
                      {copy.workflows.flowTitle}
                    </p>
                    <h3 className="font-marketing mt-3 text-2xl font-semibold tracking-[-0.03em]">
                      {copy.workflows.flowHeadline}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-1.5 text-sm text-success">
                    <span className="h-2 w-2 rounded-full bg-success" />
                    {copy.workflows.flowLive}
                  </div>
                </div>

                <div className="mt-8 space-y-4">
                  {copy.workflows.flowSteps.map(([title, detail], index) => (
                    <div key={title} className="flex gap-4 rounded-md border border-border-subtle bg-background px-4 py-4">
                      <div className="flex flex-col items-center">
                        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-sm font-bold text-primary">
                          {index + 1}
                        </span>
                        {index < 3 && <span className="mt-2 h-8 w-px bg-border" />}
                      </div>
                      <div>
                        <p className="font-marketing text-base font-semibold text-foreground">
                          {title}
                        </p>
                        <p className="mt-1 text-sm leading-7 text-muted-foreground">
                          {detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {copy.workflows.metrics.map(([label, value, detail]) => (
                  <div key={label} className="rounded-md border border-border bg-muted/20 p-5">
                    <p className="font-marketing text-sm font-semibold uppercase tracking-[0.26em] text-[#aeb6df]/44">
                      {label}
                    </p>
                    <p className="font-marketing mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
                      {value}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      {detail}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section id="insights" className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="app-panel rounded-lg px-8 py-10 md:px-12 md:py-14">
              <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
                <div>
                  <p className="font-marketing text-sm font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                    {copy.insights.eyebrow}
                  </p>
                  <h2 className="font-marketing mt-5 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
                    {copy.insights.title}
                  </h2>
                  <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground">
                    {copy.insights.description}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {copy.insights.stats.map(([value, label]) => (
                    <div key={label} className="rounded-md border border-border bg-muted/20 p-5">
                      <p className="font-marketing text-3xl font-semibold tracking-[-0.04em] text-foreground">
                        {value}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="security" className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="font-marketing text-sm font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                {copy.security.eyebrow}
              </p>
              <h2 className="font-marketing mt-5 text-4xl font-semibold tracking-[-0.04em] text-foreground md:text-5xl">
                {copy.security.title}
              </h2>
              <p className="mt-6 text-base leading-8 text-muted-foreground">
                {copy.security.description}
              </p>
            </div>

            {/* Mobile Carousel */}
            <div className="md:hidden mt-14">
              <Carousel opts={{ align: "start", loop: true }}>
                <CarouselContent>
                  {copy.security.cards.map((item) => (
                    <CarouselItem key={item.title} className="basis-full">
                      <article className="app-panel rounded-lg p-7">
                        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 p-2 text-primary">
                          <img
                            src="/landing-icons/security.png"
                            alt=""
                            className="h-full w-full object-contain"
                            aria-hidden="true"
                          />
                        </div>
                        <h3 className="font-marketing mt-6 text-2xl font-semibold tracking-[-0.03em]">
                          {item.title}
                        </h3>
                        <p className="mt-4 text-sm leading-7 text-muted-foreground">
                          {item.body}
                        </p>
                      </article>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <div className="flex justify-center gap-2 mt-4">
                  <CarouselPrevious className="relative position-static mx-0" />
                  <CarouselNext className="relative position-static mx-0" />
                </div>
              </Carousel>
            </div>

            {/* Desktop Grid */}
            <div className="hidden md:grid mt-14 grid gap-6 md:grid-cols-3">
              {copy.security.cards.map((item) => (
                <article key={item.title} className="app-panel rounded-lg p-7">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 p-2 text-primary">
                    <img
                      src="/landing-icons/security.png"
                      alt=""
                      className="h-full w-full object-contain"
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="font-marketing mt-6 text-2xl font-semibold tracking-[-0.03em]">
                    {item.title}
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">
                    {item.body}
                  </p>
                </article>
              ))}
            </div>

            <div className="relative mt-12 overflow-hidden rounded-lg border border-border bg-card px-8 py-10 text-center md:px-12 md:py-14">
              <img
                src="/landing-icons/readytolunch.png"
                alt=""
                className="absolute left-1/2 top-1/2 h-[124%] w-[124%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover object-center opacity-[0.14] grayscale"
                aria-hidden="true"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, hsl(var(--card) / 0.82) 0%, hsl(var(--card) / 0.94) 100%)",
                }}
              />
              <div className="relative z-10 mx-auto max-w-4xl">
                <p className="font-marketing text-sm font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                  {copy.security.ctaEyebrow}
                </p>
                <h2 className="font-marketing mt-5 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
                  {copy.security.ctaTitle}
                </h2>
                <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-muted-foreground">
                  {copy.security.ctaDescription}
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Link href="/login" className="font-marketing inline-flex items-center gap-2 rounded-md bg-primary px-8 py-4 text-base font-semibold text-primary-foreground transition hover:bg-primary/90">
                      {copy.security.ctaPrimary}
                      <ArrowRight className="h-5 w-5" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => scrollToSection("platform")}
                    className="font-marketing rounded-md border border-border bg-card px-6 py-4 text-sm font-semibold text-foreground transition hover:bg-muted/40"
                  >
                    {copy.security.ctaSecondary}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
