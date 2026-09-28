import { useEffect, useRef, type ReactNode } from "react";

import { RECEDE_SCALE, RECEDE_SHADE, recedeTransform } from "./recede";
import { subscribe } from "./ticker";

/**
 * The sticky stack.
 *
 * The first blocks of the page do not scroll away. Each one pins at the top of the
 * viewport and the next comes out over it, and the covered one *recedes* — scaling
 * down and darkening — rather than leaving. The last layer is the only one that
 * returns the page to ordinary flow, so the stack has a beginning and an end instead
 * of being an effect that never ends.
 *
 * Two structural rules, both of which cost an afternoon to rediscover if broken, and
 * both explained where they are enforced: the transform goes on an inner wrapper and
 * never on the sticky element, and there is no transform at rest. See `recede.ts`.
 */

const LAYER = "data-sticky-layer";
const INNER = "data-sticky-inner";
const SHADE = "data-sticky-shade";

/**
 * A pinned layer. `children` is the block itself; this owns only the positioning, the
 * transform target and the shade, and deliberately exposes no props for the transform
 * or the recede maths — a caller that could set those would eventually set them wrong.
 *
 * `shade` is the colour the covered layer darkens toward. It is a prop rather than a
 * token name so this file carries no opinion about any design system.
 */
export function StickyLayer({
  children,
  className,
  shade = "rgb(0 0 0)",
}: {
  children: ReactNode;
  className?: string;
  shade?: string;
}) {
  return (
    <div data-sticky-layer="" className={`sticky top-0 ${className ?? ""}`}>
      <div data-sticky-inner="" className="origin-center">
        {children}
      </div>
      <div
        data-sticky-shade=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: shade, opacity: 0 }}
      />
    </div>
  );
}

/**
 * The stack container. Wrap the pinned blocks in this and give it the page's dark
 * ground, which is what a covered layer recedes *into*.
 */
export function StickyStack({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = root.current;
    if (!container) return;

    /** One resolved layer: the three nodes the recede writes to, plus its last state. */
    type Resolved = {
      inner: HTMLElement | null;
      shade: HTMLElement | null;
      lastProgress: number;
    };

    const collect = (): Resolved[] =>
      Array.from(container.querySelectorAll<HTMLElement>(`[${LAYER}]`)).map((element) => ({
        inner: element.querySelector<HTMLElement>(`[${INNER}]`),
        shade: element.querySelector<HTMLElement>(`[${SHADE}]`),
        lastProgress: Number.NaN,
      }));

    let layers = collect();

    // A phone has no room to give a scaled layer back: at that width the shrunken type
    // is unreadable, so the stack shades and does not shrink.
    const phone = window.matchMedia("(max-width: 639px)");

    const apply = (force: boolean) => {
      const view = window.innerHeight || 1;
      const shrink = phone.matches ? 0 : 1 - RECEDE_SCALE;
      const elements = Array.from(container.querySelectorAll<HTMLElement>(`[${LAYER}]`));

      // Pass one reads every position, pass two writes every style. Interleaving them
      // makes each write invalidate the layout the next read depends on, and a
      // five-layer stack thrashes.
      const progresses = elements.map((_, index) => {
        const next = elements[index + 1];
        if (!next) return 0;
        // 0 while the next layer is still a full screen away, 1 once it has taken the
        // whole viewport.
        return Math.min(1, Math.max(0, 1 - next.getBoundingClientRect().top / view));
      });

      elements.forEach((_, index) => {
        const layer = layers[index];
        const progress = progresses[index];
        if (!layer) return;

        if (!force && progress === layer.lastProgress) return;
        layer.lastProgress = progress;

        if (layer.inner) {
          const transform = recedeTransform(progress, shrink);
          layer.inner.style.transform = transform;
          layer.inner.style.willChange = transform ? "transform" : "";
          // Fully covered: stop painting the scene behind the layer above it.
          layer.inner.style.visibility = progress >= 1 ? "hidden" : "visible";
        }
        if (layer.shade) layer.shade.style.opacity = `${RECEDE_SHADE * progress}`;
      });
    };

    // The shared ticker runs whether or not the page is moving. Skipping the frame
    // outright when `scrollY` has not changed keeps a resting page off the layout path.
    let lastScrollY = Number.NaN;
    const stopTicking = subscribe(() => {
      if (window.scrollY === lastScrollY) return;
      lastScrollY = window.scrollY;
      apply(false);
    });

    const remeasure = () => {
      // The layer set is static in practice, but if it is not, the pairing has to be
      // rebuilt before the recede can mean anything.
      if (container.querySelectorAll(`[${LAYER}]`).length !== layers.length) layers = collect();
      lastScrollY = Number.NaN;
      apply(true);
    };

    window.addEventListener("resize", remeasure);
    phone.addEventListener("change", remeasure);
    apply(true);

    return () => {
      stopTicking();
      window.removeEventListener("resize", remeasure);
      phone.removeEventListener("change", remeasure);
    };
  }, []);

  return (
    <div ref={root} className={`relative ${className ?? ""}`}>
      {children}
    </div>
  );
}
