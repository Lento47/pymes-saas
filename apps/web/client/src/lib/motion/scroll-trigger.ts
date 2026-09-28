import { useEffect, useRef, type RefObject } from "react";

import { subscribe } from "./ticker";

/** An edge of the element being measured. */
export type Edge = "top" | "center" | "bottom";

/** An edge of the element paired with an edge of the viewport. */
export type Pose = `${Edge}_${Edge}`;

/** The nine positions, all relative to the viewport, exactly as named. */
export type Poses = Record<Pose, number>;

type RectLike = { top: number; height: number; bottom: number };

/**
 * Where one edge of an element currently sits relative to one edge of the viewport.
 * `top_top` is the element's top at the viewport's top; `bottom_bottom` is its bottom
 * at the viewport's bottom, and so on for all nine combinations.
 */
export function poses(rect: RectLike, viewportHeight: number): Poses {
  const middle = rect.top + rect.height / 2;
  const half = viewportHeight / 2;

  return {
    top_top: rect.top,
    center_top: middle,
    bottom_top: rect.bottom,
    top_bottom: rect.top - viewportHeight,
    center_bottom: middle - viewportHeight,
    bottom_bottom: rect.bottom - viewportHeight,
    top_center: rect.top - half,
    center_center: middle - half,
    bottom_center: rect.bottom - half,
  };
}

/**
 * How far through its scroll range an element is: `0` at `start`, `1` at `end`,
 * linear in between and clamped outside.
 *
 * The reference design writes this as `1 - (scrollStart + length) / length`, which
 * only produces 0 and 1 at the two right moments for one particular pairing of start
 * and end poses, and degenerates for the other eight. This form is the same intent
 * stated without the special case: both edges of the range are known, so the fraction
 * of the distance covered is the distance covered. It also reads correctly in both
 * directions, which is what lets a caller express a trigger for an element arriving
 * from below and one arriving from above without a second code path.
 */
export function triggerProgress(current: number, start: number, end: number): number {
  const length = end - start;

  // A zero-length range cannot be scrubbed through. Treat "already at the end" as
  // complete, which is the honest answer for an element sitting exactly on its trigger.
  if (Math.abs(length) < 0.0001) return current >= end ? 1 : 0;

  const progress = (current - start) / length;
  if (progress <= 0) return 0;
  return progress >= 1 ? 1 : progress;
}

/**
 * Progress for a trigger expressed as a pair of poses.
 *
 * The subtlety: every one of the nine poses moves with the element, so reading `start`
 * and `end` at the same instant cannot describe a range — both have already travelled
 * by the time you look. What *is* stable is the signed distance between the element's
 * two chosen edges, which is its own height or the viewport's and does not change while
 * the element keeps its size.
 *
 * So progress is how far the start edge has travelled along that signed span, measured
 * from the origin where that edge sat at the viewport's top. A block entering from
 * below has a negative span, and the fraction still comes out positive without a
 * special case — which is the reason the span is signed rather than an absolute
 * length.
 */
export function poseProgress(measured: Poses, start: Pose, end: Pose): number {
  return triggerProgress(measured[start], 0, measured[start] - measured[end]);
}

/** A value a scrub can interpolate: a bare number, a number with a unit, or a mapper. */
export type Interpolable = number | `${number}${string}` | ((value: `${number}${string}`) => string);

/** The numeric part of any endpoint, whatever shape it arrived in. */
function toNumber(value: Interpolable): number {
  if (typeof value === "number") return value;
  if (typeof value === "function") return Number.parseFloat(value("0"));
  return Number.parseFloat(value);
}

/** The unit suffix on a string endpoint, or `""` when it is a bare number. */
function unitOf(value: Interpolable): string {
  return typeof value === "string" ? value.replace(/^-?[\d.]+/, "") : "";
}

/**
 * Interpolate `from` to `to` by `progress`, preserving the shape of the endpoints.
 *
 * Accepting three shapes is what lets one trigger drive a numeric opacity, a
 * `translateY(0.5rem)` and a bare `1.5` scale without the caller writing three
 * separate callbacks at the call site.
 */
export function interpolate(from: Interpolable, to: Interpolable, progress: number): number | string {
  // Two transform functions: the caller owns the whole interpolation, so hand it the
  // progress as a percentage and let it decide what that means.
  if (typeof from === "function" && typeof to === "function") {
    return from(`${progress * 100}%` as `${number}${string}`);
  }

  const fromNumber = toNumber(from);
  const toNumberValue = toNumber(to);

  // An endpoint that is not a number at all cannot be interpolated. Snap to whichever
  // end is nearer rather than emitting `NaN` into a style.
  if (Number.isNaN(fromNumber) || Number.isNaN(toNumberValue)) {
    const chosen = progress < 0.5 ? from : to;
    return typeof chosen === "function" ? chosen("0") : chosen;
  }

  const value = fromNumber + (toNumberValue - fromNumber) * progress;

  // A unit on either endpoint is a unit on the result. A transform-function endpoint is
  // handed the interpolated number and owns its own units.
  if (typeof from === "string" || typeof to === "string") {
    const unit = unitOf(from) || unitOf(to);
    return unit ? `${value}${unit}` : value;
  }
  if (typeof from === "function") return from(`${value}` as `${number}${string}`);
  if (typeof to === "function") return to(`${value}` as `${number}${string}`);

  return value;
}

type TriggerOptions = {
  /** Where progress is 0. */
  start: Pose;
  /** Where progress is 1. */
  end: Pose;
  /** Interpolate `from` to `to` across the range. Omit for a toggle. */
  scrub?: { from: Interpolable; to: Interpolable };
  /** Called once, the first time the range completes. */
  onComplete?: () => void;
  /** `IntersectionObserver` root margin. Defaults to arming 25% up the viewport. */
  rootMargin?: string;
};

/**
 * Frames of grace after the element leaves the viewport, during which the trigger keeps
 * computing. Without it a trigger stops one frame before the element is fully gone,
 * which is visible as a stall in whatever it is driving.
 */
const TRAILING_FRAMES = 10;

/**
 * Drive a value from the element's scroll position.
 *
 * The trigger only computes while its element is in the viewport plus those ten
 * trailing frames. That is the rule every canvas on the page uses, and it is what
 * keeps a page of five blocks from running five rAF loops for content nobody is
 * looking at.
 */
export function useScrollTrigger<T extends HTMLElement>(
  options: TriggerOptions,
  onFrame?: (value: number | string, progress: number) => void,
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const {
    start,
    end,
    scrub,
    onComplete,
    rootMargin = "0% 0% -25% 0%",
  } = options;

  // Read through a ref so changing a callback does not tear down the observer and the
  // ticker subscription on every render.
  const configRef = useRef({ start, end, scrub, onComplete });
  configRef.current = { start, end, scrub, onComplete };

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let inView = false;
    let trailing = 0;
    let completed = false;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            inView = true;
            trailing = TRAILING_FRAMES;
          } else {
            inView = false;
          }
        }
      },
      { rootMargin },
    );
    observer.observe(element);

    const stopTicking = subscribe(() => {
      if (!inView) {
        if (trailing > 0) trailing -= 1;
        else return;
      }

      const current = configRef.current;
      const rect = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      const measured = poses(rect, viewportHeight);

      const progress = poseProgress(measured, current.start, current.end);

      if (current.onComplete && progress >= 1 && !completed) {
        completed = true;
        current.onComplete();
      }

      if (!current.scrub) return;
      onFrameRef.current?.(interpolate(current.scrub.from, current.scrub.to, progress), progress);
    });

    return () => {
      observer.disconnect();
      stopTicking();
    };
  }, [rootMargin]);

  return ref;
}
