"use client";

/*
  `next/image` replaced with a plain `<img>`.

  Arc's `avatar` ships a Next.js `Image`, and this app is Vite — there is no `next` package
  installed, so the file as vendored does not compile. Arc's own troubleshooting lists this as a
  known adjustment for Vite.

  What is lost is Next's image optimisation: no automatic sizing, no lazy loading, no modern
  format negotiation, and no `srcset` unless one is passed. For this component that is a small
  cost — an avatar is one small image per row or per person, already sized by the CSS module's
  `.sm`/`.md`/`.lg`/`.xl` classes, and the `sizes` attribute it used has no equivalent outside
  Next's loader.

  What is kept is the behaviour the component is actually built around: the decoded-photo-shows-
  at-once rule, the `data-loading` swap that holds a blur until the bytes land, and the fallback
  to initials on error. Those are the parts with a fallback path, and a plain `img` implements
  all three identically.
*/
import { useLayoutEffect, useRef, useState, type HTMLAttributes } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./avatar.module.css";
export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> { name: string; src?: string; size?: "sm" | "md" | "lg" | "xl"; status?: "online" | "offline" }
export function Avatar({ name, src, size = "md", status, className, ...props }: AvatarProps) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("");
  const reduceMotion = !!useReducedMotion();
  const image = useRef<HTMLImageElement>(null);
  const [failedSrc, setFailedSrc] = useState<string>();
  // A photo that is already decoded shows at once. One that is still loading waits, then fades in from a soft blur.
  useLayoutEffect(() => { const node = image.current; if (node && !node.complete) node.dataset.loading = ""; }, [src]);
  const showImage = src && failedSrc !== src;
  return <span {...props} className={[styles.avatar, styles[size], className].filter(Boolean).join(" ")} role="img" aria-label={`${name}${status ? `, ${status}` : ""}`}>
    {showImage ? <img key={src} ref={image} src={src} alt="" onLoad={event => { delete event.currentTarget.dataset.loading; }} onError={() => setFailedSrc(src)} /> : <span className={src ? styles.fallback : undefined} aria-hidden="true">{initials}</span>}
    <AnimatePresence initial={false}>{status && <motion.i key={status} className={[styles.status, styles[status]].join(" ")} aria-hidden="true" initial={{ opacity: 0, scale: .6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .6, transition: { duration: reduceMotion ? 0 : motionTokens.duration.fast } }} transition={reduceMotion ? { duration: 0 } : motionTokens.spring.snappy} />}</AnimatePresence>
  </span>;
}
