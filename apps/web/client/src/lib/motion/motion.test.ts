import { describe, expect, it } from "vitest";

import { interpolate, poseProgress, poses, triggerProgress } from "./scroll-trigger";
import { RECEDE_SCALE, RECEDE_SHADE, recedeTransform } from "./recede";
import { subscriberCount, subscribe } from "./ticker";

/**
 * The motion primitives, asserted without a DOM.
 *
 * These are the pieces a rendered check cannot reach: a recede that is 2% wrong at
 * scroll depth 400 looks correct in a screenshot and feels wrong under a thumb, and a
 * trigger whose progress is inverted is invisible until the page is scrolled.
 */

describe("recedeTransform", () => {
  it("writes no transform at rest", () => {
    // The load-bearing rule. A `scale(1)` left on the element makes the layer the
    // containing block for anything `position: fixed` inside it, which is how a
    // full-screen veil ends up centred in a section instead of in the viewport.
    expect(recedeTransform(0, 1 - RECEDE_SCALE)).toBe("");
  });

  it("scales a fully covered layer to the recede scale", () => {
    expect(recedeTransform(1, 1 - RECEDE_SCALE)).toBe(`scale(${RECEDE_SCALE})`);
  });

  it("writes no transform when the shrink is zero, as on a phone", () => {
    // The stack shades on a phone but does not shrink; at that width the shrunken type
    // would be unreadable. Zero progress must therefore not become `scale(1)`.
    expect(recedeTransform(1, 0)).toBe("");
  });

  it("interpolates between the two", () => {
    expect(recedeTransform(0.5, 1 - RECEDE_SCALE)).toBe(`scale(${1 - (1 - RECEDE_SCALE) * 0.5})`);
  });
});

describe("the stack constants", () => {
  it("keeps the reference's recede values", () => {
    expect(RECEDE_SCALE).toBe(0.9);
    expect(RECEDE_SHADE).toBe(0.55);
  });
});

describe("triggerProgress", () => {
  it("is 0 at the start pose and 1 at the end pose", () => {
    expect(triggerProgress(100, 100, 0)).toBe(0);
    expect(triggerProgress(0, 100, 0)).toBe(1);
  });

  it("clamps outside its range", () => {
    expect(triggerProgress(500, 100, 0)).toBe(0);
    expect(triggerProgress(-500, 100, 0)).toBe(1);
  });

  it("reads the same forwards as backwards", () => {
    // A trigger whose range runs the other way — an element arriving from above —
    // must not need a second code path.
    expect(triggerProgress(0, 0, 100)).toBe(0);
    expect(triggerProgress(50, 0, 100)).toBe(0.5);
    expect(triggerProgress(100, 0, 100)).toBe(1);
  });

  it("treats a zero-length range as complete rather than dividing by zero", () => {
    expect(triggerProgress(10, 10, 10)).toBe(1);
    expect(triggerProgress(9, 10, 10)).toBe(0);
  });
});

describe("poses", () => {
  const rect = { top: 200, height: 400, bottom: 600 };
  const viewport = 1000;

  it("places every edge against every viewport edge", () => {
    const measured = poses(rect, viewport);

    expect(measured.top_top).toBe(200);
    expect(measured.center_top).toBe(400);
    expect(measured.bottom_top).toBe(600);
    expect(measured.top_bottom).toBe(-800);
    expect(measured.center_bottom).toBe(-600);
    expect(measured.bottom_bottom).toBe(-400);
    expect(measured.top_center).toBe(-300);
    expect(measured.center_center).toBe(-100);
    expect(measured.bottom_center).toBe(100);
  });

  it("runs a bottom-to-top reveal across exactly one element-height of scroll", () => {
    const height = 400;
    const viewport = 1000;
    const at = (rectTop: number) =>
      poseProgress(poses({ top: rectTop, height, bottom: rectTop + height }, viewport), "top_bottom", "bottom_bottom");

    // The block's top crossing the viewport's top is the origin. One element-height
    // later the block has fully arrived, which is where the reveal completes.
    expect(at(viewport)).toBeCloseTo(0);
    expect(at(viewport - height)).toBeCloseTo(1);

    // Below that it clamps rather than going negative, above it rather than exceeding 1.
    expect(at(viewport + 400)).toBe(0);
    expect(at(0)).toBe(1);
  });

  it("inverts exactly when the two edges are swapped", () => {
    // Swapping start and end walks the same span from the other end, so the two must
    // sum to 1. This is what proves the span is handled as a signed distance: if the
    // implementation took an absolute length, one of the pair would come out negative.
    const rect = { top: 300, height: 400, bottom: 700 };
    const measured = poses(rect, 1000);

    const forward = poseProgress(measured, "top_bottom", "bottom_bottom");
    const reverse = poseProgress(measured, "bottom_bottom", "top_bottom");

    expect(forward + reverse).toBeCloseTo(1);
  });
});

describe("interpolate", () => {
  it("interpolates bare numbers", () => {
    expect(interpolate(0, 1, 0.5)).toBe(0.5);
    expect(interpolate(1, 3, 0)).toBe(1);
  });

  it("preserves a unit from either endpoint", () => {
    expect(interpolate("0rem", "2rem", 0.5)).toBe("1rem");
    expect(interpolate(0, "1.5rem", 1)).toBe("1.5rem");
  });

  it("hands a transform function the interpolated number", () => {
    const from = (value: `${number}${string}`) => `translateY(${value})`;
    const to = (value: `${number}${string}`) => `scale(${value})`;

    expect(interpolate(from, to, 0.5)).toBe("translateY(50%)");
  });

  it("snaps rather than emitting NaN for an endpoint it cannot read", () => {
    const unreadable = ((_: `${number}${string}`) => "x") as unknown as number;
    expect(interpolate(unreadable, 1, 0.2)).toBe("x");
    expect(interpolate(unreadable, 1, 0.8)).toBe(1);
  });
});

describe("the ticker", () => {
  it("starts empty and parks itself when the last subscriber leaves", () => {
    expect(subscriberCount()).toBe(0);

    const stop = subscribe(() => {});
    expect(subscriberCount()).toBe(1);

    stop();
    expect(subscriberCount()).toBe(0);
  });

  it("tolerates an unsubscribe called twice", () => {
    // A component that unmounts twice, or a hot reload, must not decrement the count
    // below the number of live subscribers and leave the loop cancelled.
    const stop = subscribe(() => {});
    const other = subscribe(() => {});
    expect(subscriberCount()).toBe(2);

    stop();
    stop();
    expect(subscriberCount()).toBe(1);

    other();
    expect(subscriberCount()).toBe(0);
  });
});
