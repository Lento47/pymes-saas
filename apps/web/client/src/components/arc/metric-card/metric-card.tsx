"use client";


import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type Variants } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { AnimatedCounter } from "../animated-counter/animated-counter";
import { motionTokens } from "../lib/motion-tokens";

import styles from "./metric-card.module.css";

export interface MetricCardProps {
  label: string;
  value: number;
  suffix?: string;
  context: string;
  change?: string;
  /**
   * Marks the card as the one that needs attention, and paints its border amber.
   *
   * **Added here, and it is not an Arc prop.** The console's queue tile has to be visibly
   * different when something is waiting — `pendingVerification > 0` is the one number on
   * this screen with a deadline attached to it, and "3" in a card that looks like the other
   * ten is not a signal. Arc has no such prop and adding one was the smaller change than
   * wrapping every tile to bolt a class on from outside.
   */
  urgent?: boolean;
  /**
   * Roll the digits up from zero on first view. On by default, because that is what the
   * component is for.
   *
   * **Also not an Arc prop**, and it exists for the opposite reason to `urgent`: a dashboard
   * of twelve tiles all animating at once is not motion, it is a page load that looks like it
   * is performing, and it flattens the numbers that actually matter into the same visual noise
   * as the nine that do not. Set `false` on the reference tiles and the number is rendered as
   * static, tabular text — still announced identically to a screen reader, because the
   * accessible copy never depended on the animation.
   */
  animate?: boolean;
}

/** Copy that holds a number enters from the side it moved toward: a larger value rises from below, a smaller one drops from above. */
const rise: Variants = { hidden: (direction: number) => ({ opacity: 0, y: `${.3 * direction}em`, filter: `blur(${motionTokens.blur.soft}px)` }), shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] } }, gone: (direction: number) => ({ opacity: 0, y: `${-.3 * direction}em`, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } }) };

const fade: Variants = { hidden: { opacity: 0, y: 0, filter: "blur(0px)" }, shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: motionTokens.duration.instant } }, gone: { opacity: 0, y: 0, filter: "blur(0px)", transition: { duration: motionTokens.duration.instant } } };
const amountIn = (text: string) => Number(text.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0] ?? NaN);

/** New copy rises in while the old copy leaves; `morph` springs the wrapper to the new text's width instead of letting it snap. */
function Swap({ text, morph = false, block = false }: { text: string; morph?: boolean; block?: boolean }) {
  const reduceMotion = !!useReducedMotion();
  const sizer = useRef<HTMLSpanElement>(null);
  const width = useMotionValue<number | "auto">("auto");
  const [shown, setShown] = useState({ text, direction: 1 });
  if (shown.text !== text) setShown({ text, direction: amountIn(text) < amountIn(shown.text) ? -1 : 1 });
  useEffect(() => {
    const node = sizer.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let measured: string | null = null;
    // Layout size, not the transformed rect, so a scaling parent never leaves the text clipped. Only a new text springs; font loads jump.
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.borderBoxSize?.[0]?.inlineSize ?? node.offsetWidth;
      if (next && measured !== null && measured !== node.textContent && !reduceMotion) animate(width, next, motionTokens.spring.morph);
      else width.jump(next || "auto");
      measured = next ? node.textContent : null;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [morph, reduceMotion, width]);
  return <motion.span className={block ? styles.swapBlock : styles.swap} style={morph ? { width } : undefined}>
    {morph && <span ref={sizer} className={styles.sizer} aria-hidden="true">{text}</span>}
    <AnimatePresence mode="popLayout" initial={false} custom={shown.direction}><motion.span key={text} className={styles.text} custom={shown.direction} variants={reduceMotion ? fade : rise} initial="hidden" animate="shown" exit="gone">{text}</motion.span></AnimatePresence>
  </motion.span>;
}

export function MetricCard({ label, value, suffix, context, change, urgent, animate = true }: MetricCardProps) {
  const reduceMotion = !!useReducedMotion();

  /**
   * The static branch, and it is **not** a second rendering of the number — it is the same
   * text Arc's counter would have announced, without the wheel of ten absolutely positioned
   * glyphs per column behind it. Reading it costs one text node instead of thirty, and it is
   * legible the instant it paints rather than after a stagger.
   */
  const staticValue = (
    <span className={styles.static}>
      {value}
      {suffix ? <span className={styles.staticSuffix}>{suffix}</span> : null}
    </span>
  );

  return <article className={styles.card} data-urgent={urgent ? "true" : undefined}>
    <div className={styles.top}><span><Swap text={label} block /></span><AnimatePresence initial={false}>{change && <motion.small key="change" data-trend={/^[+]/.test(change) ? "up" : /^[-−]/.test(change) ? "down" : undefined} initial={{ opacity: 0, scale: reduceMotion ? 1 : .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: reduceMotion ? 1 : .96, transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } }} transition={reduceMotion ? { duration: 0 } : motionTokens.spring.snappy}><Swap text={change} morph /></motion.small>}</AnimatePresence></div>
    {animate ? <AnimatedCounter value={value} suffix={suffix} animateOnView /> : staticValue}
    <p><Swap text={context} block /></p>
  </article>;
}