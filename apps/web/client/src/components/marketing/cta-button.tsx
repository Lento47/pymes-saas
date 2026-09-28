import React from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────────
   The chamfered CTA — the site's own button, not a generic pill.

   Taken from the design guide (commerce Web.md): a 220×50 frame with a cut
   bottom-right corner, an amber flood that wipes in from the left on hover,
   corner brackets in the accent, and an arrow that steps forward. The label
   inverts to the surface black over the flood. Used everywhere the marketing
   pages previously dropped a `rounded-full bg-amber-500` pill.
   ────────────────────────────────────────────────────────────────────────── */

/** The frame geometry, from the guide: body path + corner brackets. */
const CTA_BODY = "M220 42L212.932 50H0V0H220V42Z";
const CTA_BRACKETS =
  "M205 49.5H213L219.5 42V36 M212 0.5H219.5V7 M8 0.5H0.5V7 M7.5 49.5H0.5V42.5";
const ARROW_PATH = "M0 5.35355H13M8 10.3536L13 5.35355L8 0.353553";

function Arrow({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 13.7071 10.7071"
      fill="none"
      className={cn("h-[0.5em] w-[0.65em] shrink-0 transition-transform duration-150 group-hover:translate-x-1", className)}
    >
      <path d={ARROW_PATH} stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** The frame drawn once — body fill, hover flood, accent brackets. */
function CtaFrame() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 220 50"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
    >
      {/* Frame: body fill → flood on hover, brackets above the flood. */}
      <path d={CTA_BODY} className="fill-[#0E0F14]" />
      <path
        d={CTA_BODY}
        className="fill-[#f59e0b] origin-left scale-x-0 transition-transform duration-[250ms] ease-[cubic-bezier(0.33,0,0,1)] group-hover:scale-x-100"
      />
      <path d={CTA_BODY} fill="none" stroke="#f59e0b" strokeOpacity="0.25" />
      <path d={CTA_BRACKETS} className="stroke-[#f59e0b]" fill="none" />
    </svg>
  );
}

interface ChamferedCtaProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  /** Full-width on small screens inside stacked action rows. */
  fullWidth?: boolean;
}

/** Primary action — filled frame, accent flood on hover. */
export function ChamferedCta({ href, children, className, fullWidth }: ChamferedCtaProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative inline-flex select-none items-center justify-center gap-[1.6em] px-6 text-[0.875rem] font-semibold uppercase leading-none tracking-[0.08em]",
        "h-12 w-full sm:h-[3.125rem] sm:w-auto sm:px-8",
        className,
      )}
    >
      <CtaFrame />
      {/* Label: accent → black over the flood. */}
      <span className="relative z-10 text-[#f59e0b] transition-colors duration-[250ms] group-hover:text-[#05091d]">
        {children}
      </span>
      <Arrow className="relative z-10 text-[#f59e0b] transition-colors duration-[250ms] group-hover:text-[#05091d]" />
    </Link>
  );
}

interface ChamferedSubmitProps {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  /** Shown in place of the label while the form is submitting. */
  pending?: React.ReactNode;
  testId?: string;
}

/**
 * The same chamfered frame as the marketing CTA, rendered as a form's submit
 * button. Form actions are not links, so this variant carries the frame onto
 * a native `<button type="submit">` — same flood, same brackets, same arrow.
 */
export function ChamferedSubmit({ children, className, disabled, pending, testId }: ChamferedSubmitProps) {
  return (
    <button
      type="submit"
      disabled={disabled}
      data-testid={testId}
      className={cn(
        "group relative inline-flex h-[3.125rem] w-full select-none items-center justify-center gap-[1.6em] px-8 text-[0.875rem] font-semibold uppercase leading-none tracking-[0.08em]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      <CtaFrame />
      <span className="relative z-10 text-[#f59e0b] transition-colors duration-[250ms] group-hover:text-[#05091d]">
        {pending ?? children}
      </span>
      {pending ? null : (
        <Arrow className="relative z-10 text-[#f59e0b] transition-colors duration-[250ms] group-hover:text-[#05091d]" />
      )}
    </button>
  );
}

/** Secondary action — hollow chamfer, accent outline, flood on hover. */
export function ChamferedCtaGhost({ href, children, className }: ChamferedCtaProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative inline-flex select-none items-center justify-center gap-[1.6em] px-6 text-[0.875rem] font-semibold uppercase leading-none tracking-[0.08em]",
        "h-12 w-full sm:h-[3.125rem] sm:w-auto sm:px-8",
        className,
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 220 50"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <path d={CTA_BODY} className="fill-transparent" />
        <path
          d={CTA_BODY}
          className="fill-[#f59e0b]/10 origin-left scale-x-0 transition-transform duration-[250ms] ease-[cubic-bezier(0.33,0,0,1)] group-hover:scale-x-100"
        />
        <path
          d="M219.5 42L212.932 49.5H0.5V0.5H219.5V42Z"
          fill="none"
          className="stroke-white/25 transition-colors duration-[250ms] group-hover:stroke-[#f59e0b]"
        />
      </svg>
      <span className="relative z-10 text-slate-200 transition-colors duration-[250ms] group-hover:text-[#f59e0b]">
        {children}
      </span>
      <Arrow className="relative z-10 text-slate-200 transition-colors duration-[250ms] group-hover:text-[#f59e0b]" />
    </Link>
  );
}
