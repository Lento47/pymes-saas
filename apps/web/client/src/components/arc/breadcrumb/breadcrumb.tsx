"use client";
/*
  `next/link` replaced with a plain anchor.

  Arc's `breadcrumb` ships a Next.js `Link`, and this app is Vite — there is no `next` package
  installed, so the file as vendored does not compile. Arc's own troubleshooting lists this
  ("Using Vite: an item imports `next/image` or `next/link`") as a known adjustment.

  An anchor is the right substitute rather than a wrapper component: `Link`'s value is client-side
  navigation without a full page load, and this console is a **pathname-routed** app whose
  navigation already goes through `wouter`. `wouter`'s `Link` would be the closer match, but
  reaching outside `arc/` for it would make a vendored file depend on the app, which is the
  coupling the vendoring exists to avoid.

  So this is a real behavioural trade, stated rather than hidden: a crumb is now a full page
  load. On a page this size that is a few milliseconds and a re-render of data already cached by
  React Query, and it keeps the file independent. If a crumb ever needs to avoid the reload, the
  fix belongs in the caller — pass `onClick` and omit `href`, which renders the crumb as a button
  and already exists in the component's API for exactly this.
*/
import type { MouseEvent } from "react";
import { ChevronRight as NavArrowRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./breadcrumb.module.css";
export interface BreadcrumbItem {
  label: string;
  href?: string;
  /** Runs when the crumb is chosen. Without an href the crumb renders as a button, for paths that live in local state. */
  onClick?: (event: MouseEvent<HTMLElement>) => void;
}
export interface BreadcrumbProps { items: BreadcrumbItem[]; ariaLabel?: string }
/** Crumbs present on first render stay still; crumbs added later slide in from the path before them. */
export function Breadcrumb({ items, ariaLabel = "Breadcrumb" }: BreadcrumbProps) {
  const reduced = useReducedMotion() ?? false;
  const still = { duration: 0 };
  const path = items.map(item => item.label).join("/");
  return <nav aria-label={ariaLabel}><ol className={styles.list}><AnimatePresence mode="popLayout" initial={false}>{items.map((item, index) => {
    const current = index === items.length - 1;
    return <motion.li key={`${item.label}-${index}`}
      layout={reduced ? false : "position"} layoutDependency={path}
      initial={reduced ? false : { opacity: 0, x: -8, filter: `blur(${motionTokens.blur.subtle}px)` }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      exit={reduced ? { opacity: 0, transition: still } : { opacity: 0, x: -4, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] } }}
      transition={reduced ? still : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter], layout: motionTokens.spring.smooth }}>
      {index > 0 && <NavArrowRight width={14} height={14} aria-hidden="true"/>}
      {!current && item.href ? <a href={item.href} data-label={item.label} onClick={item.onClick}>{item.label}</a>
        : !current && item.onClick ? <button type="button" data-label={item.label} onClick={item.onClick}>{item.label}</button>
        : <span aria-current={current ? "page" : undefined} data-label={item.label}>{item.label}</span>}
    </motion.li>;
  })}</AnimatePresence></ol></nav>;
}
