import {
  useEffect,
  useRef,
  useState,
  type ElementType,
  type RefObject,
  type ReactNode,
} from "react";
import { motion, useInView, useReducedMotion, type Transition } from "framer-motion";

import { SPRINGS } from "./springs";

/**
 * The text engine.
 *
 * A block of type is split into units — words, or letters for short runs — and each
 * unit runs its own spring from an out-state to an in-state, offset by a per-unit
 * stagger. It is the reason a headline on this page reads as arriving rather than
 * appearing, and it is why the same primitive serves a display name, a paragraph and a
 * column of footer links.
 *
 * Two rules are not negotiable, both from the reference design:
 *
 *  1. The plain string stays in the accessibility tree. The split spans are marked
 *     `aria-hidden` and a visually-hidden copy carries the real text, so a screen
 *     reader announces a sentence rather than forty separate words.
 *  2. Nothing here clips. The display leading on this page is tight, and an
 *     `overflow: hidden` on a unit would shave the descenders off every `g`, `y` and
 *     `p` in the block.
 */

export type RevealMode =
  /** Animates in while enabled and back out when not — a hover or a toggle state. */
  | "always"
  /** Plays in once per mount and never replays. */
  | "once"
  /** Plays in when enabled, and on the way back up the page holds the in-state instead
   *  of reversing, provided the page has scrolled past the block's top. */
  | "forward";

export type RevealUnit = "words" | "letters";

/** One word, and the letters inside it when the caller asked for letters. */
type Unit = { word: string; letters: string[] | null };

/**
 * `Array.from` rather than `split("")` so a character outside the basic multilingual
 * plane — an accented capital, an emoji in a merchant's name — is not torn into
 * surrogate halves.
 */
function toUnits(text: string, unit: RevealUnit): Unit[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({ word, letters: unit === "letters" ? Array.from(word) : null }));
}

/** The out-state a unit starts from. Letters rise less far than words do. */
function outState(unit: RevealUnit) {
  return { opacity: 0, y: unit === "letters" ? "0.3em" : "0.35em" };
}

const IN_STATE = { opacity: 1, y: "0em" };

type TextRevealProps = {
  text: string;
  /** Rendered element. The reveal never changes layout, so this is safe to set. */
  as?: ElementType;
  mode?: RevealMode;
  unit?: RevealUnit;
  /** Milliseconds between consecutive units. */
  stagger?: number;
  /** Milliseconds before the first unit starts. */
  delay?: number;
  /** Gap between words, in `em` of the container's own font size. */
  gap?: number;
  spring?: Transition;
  className?: string;
  id?: string;
};

export function TextReveal({
  text,
  as: Tag = "span",
  mode = "once",
  unit = "words",
  stagger = 28,
  delay = 0,
  gap = 0.3,
  spring = SPRINGS.reveal,
  className,
  id,
}: TextRevealProps) {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { margin: "0% 0% -15% 0%" });
  const scrolledDown = useScrolledPast(ref);
  const [hasPlayed, setHasPlayed] = useState(false);

  useEffect(() => {
    if (inView && !hasPlayed) setHasPlayed(true);
  }, [inView, hasPlayed]);

  const units = toUnits(text, unit);

  // Every hook has run by this point, so the reduced-motion path below is a plain
  // early return rather than a branch around hook calls.
  //
  // Reduced motion is not "the same animation, faster". The split is dropped entirely
  // and the real text is rendered, so there is nothing to reveal and nothing hidden
  // from assistive technology.
  if (reducedMotion) {
    return <Tag className={className} id={id}>{text}</Tag>;
  }

  // `once` latches on its own; `forward` additionally holds once the page has scrolled
  // past the block's top, which is the entire difference between the two on the way up.
  const active =
    mode === "once"
      ? hasPlayed || inView
      : mode === "forward"
        ? inView || scrolledDown
        : inView;

  // Stagger counts words, so a long word cannot push the line after it off the end of
  // its own stagger window. The word's position in `units` is that count.
  const from = outState(unit);

  return (
    <Tag className={className} id={id} ref={ref}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="inline-flex flex-wrap" style={{ columnGap: `${gap}em` }}>
        {units.map((entry, wordIndex) => {
          const at = delay + wordIndex * stagger;

          return (
            <span key={`${wordIndex}-${entry.word}`} className="inline-flex">
              {entry.letters
                ? entry.letters.map((letter, letterIndex) => (
                    <motion.span
                      key={letterIndex}
                      className="inline-block will-change-transform"
                      initial={from}
                      animate={active ? IN_STATE : from}
                      // The stagger belongs to the entrance only. Reversing with the
                      // same per-unit delay would make a hover-out crawl.
                      transition={active ? { ...spring, delay: at + letterIndex * 12 } : spring}
                    >
                      {letter}
                    </motion.span>
                  ))
                : (
                    <motion.span
                      className="inline-block will-change-transform"
                      initial={from}
                      animate={active ? IN_STATE : from}
                      transition={active ? { ...spring, delay: at } : spring}
                    >
                      {entry.word}
                    </motion.span>
                  )}
            </span>
          );
        })}
      </span>
    </Tag>
  );
}

/**
 * Whether the page has scrolled past an element's top. Latches `true` and never
 * releases, because "the reader has been here" is a fact about the session rather than
 * a momentary scroll position.
 *
 * State is only written when the answer flips, so a scroll listener running on every
 * frame does not cause a render on every frame.
 */
function useScrolledPast(ref: RefObject<HTMLElement | null>): boolean {
  const [scrolledDown, setScrolledDown] = useState(false);

  useEffect(() => {
    if (scrolledDown) return;

    const check = () => {
      const element = ref.current;
      if (element && element.getBoundingClientRect().top <= 0) setScrolledDown(true);
    };

    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, [ref, scrolledDown]);

  return scrolledDown;
}

type RevealProps = {
  children: ReactNode;
  /** Where the block starts, as a `translateY` length. */
  from?: string;
  delay?: number;
  spring?: Transition;
  className?: string;
};

/**
 * The whole-element entrance — the one that brings a masthead, a pair of panels or an
 * actions row onto the page as a single object, rather than word by word.
 */
export function Reveal({ children, from = "1.25rem", delay = 0, spring = SPRINGS.reveal, className }: RevealProps) {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "0% 0% -10% 0%" });

  if (reducedMotion) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: from }}
      animate={inView ? { opacity: 1, y: "0rem" } : { opacity: 0, y: from }}
      transition={{ ...spring, delay }}
    >
      {children}
    </motion.div>
  );
}
