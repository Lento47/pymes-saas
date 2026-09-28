import { Link } from "wouter";

import { ContourField } from "@/components/storefront/gl/contour-field";
import { useI18n } from "@/components/providers/i18n-provider";
import { TextReveal } from "@/lib/motion/text-reveal";
import { SPRINGS } from "@/lib/motion/springs";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Block five: the sign-off.
 *
 * An accent page edge with a near-black panel inset inside it, the same contour field
 * the hero uses at low opacity, and the nav resolving column by column. The legal row
 * sits along the foot.
 *
 * It is a sign-off, not a second footer: `MarketplaceShell` already renders the real
 * footer with its full link columns, the cookie preferences control and the legal
 * routes. This does not duplicate that, and it is deliberately not a replacement for it.
 */

/** The two columns, as href keys. The words come from i18n — a hardcoded English label
 *  here would be exactly the defect the shared footer already has. */
const COLUMNS = [
  {
    key: "marketplace",
    links: [
      { id: "categories", href: "/categories" },
      { id: "search", href: "/search" },
      { id: "orders", href: "/orders" },
      { id: "favorites", href: "/favorites" },
    ],
  },
  {
    key: "business",
    links: [
      { id: "sellOn", href: "/register" },
      { id: "pricing", href: "/pricing" },
      { id: "signIn", href: "/sign-in" },
    ],
  },
] as const satisfies readonly { key: "marketplace" | "business"; links: readonly { id: string; href: string }[] }[];

export function SignoffBlock() {
  const { messages } = useI18n();
  const t = messages.site.showcase.signoff;
  const nav = t.nav;
  const reducedMotion = useReducedMotion();

  return (
    <section className="showcase relative isolate overflow-hidden px-px pt-px" style={{ background: "var(--sc-amber)" }}>
      {/* Inset inside the accent edge, so the amber reads as a hairline of page edge
          rather than as a block of colour. */}
      <div className="relative isolate overflow-hidden bg-[var(--sc-surface-black)]">
        <ContourField tone="light" opacity={0.06} className="pointer-events-none absolute inset-0 h-full w-full" />

        <div className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <TextReveal
            as="h2"
            text={t.title}
            mode="forward"
            unit="words"
            stagger={38}
            className="showcase-sans max-w-[18ch] text-balance text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[0.95] tracking-[-0.05em] text-[var(--sc-on-dark)]"
          />

          <p className="showcase-sans mt-5 max-w-xl text-pretty text-base leading-relaxed text-[var(--sc-on-dark-muted)]">
            {t.subtitle}
          </p>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:max-w-2xl">
            {COLUMNS.map((column, columnIndex) => {
              const copy = nav[column.key];

              return (
                <motion.nav
                  key={column.key}
                  aria-label={copy.heading}
                  initial={reducedMotion ? false : { opacity: 0, y: "0.5rem" }}
                  whileInView={reducedMotion ? undefined : { opacity: 1, y: "0rem" }}
                  viewport={{ once: true, margin: "0px 0px -15% 0px" }}
                  transition={{ ...SPRINGS.row, delay: columnIndex * 0.08 }}
                  className="showcase-sans"
                >
                  <h3 className="text-[0.75rem] font-bold uppercase tracking-[0.18em] text-[var(--sc-amber)]">
                    {copy.heading}
                  </h3>
                  <ul className="mt-4 space-y-2.5">
                    {column.links.map((link) => (
                      <li key={link.id}>
                        <Link
                          href={link.href}
                          className="text-sm text-[var(--sc-on-dark-muted)] transition-colors hover:text-[var(--sc-on-dark)]"
                        >
                          {copy[link.id as keyof typeof copy]}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </motion.nav>
              );
            })}
          </div>

          <p className="showcase-sans mt-14 border-t border-[var(--sc-panel-line)] pt-6 text-xs text-[var(--sc-white-alpha-40)]">
            {t.legal}
          </p>
        </div>
      </div>
    </section>
  );
}
