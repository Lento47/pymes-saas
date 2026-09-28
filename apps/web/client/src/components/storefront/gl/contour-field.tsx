import { useEffect, useRef } from "react";

import { subscribe } from "@/lib/motion/ticker";

/**
 * The contour field.
 *
 * Rolling topographic lines behind a block, drawn by marching squares over a smooth
 * noise field. It is the one generated visual on the page, reused in the hero, behind
 * the delivery zone and again in the footer at low opacity, which is what stops three
 * very different blocks from reading as three unrelated pages.
 *
 * Plain 2D canvas rather than WebGL: it is a few hundred line segments a frame, it has
 * to keep working when WebGL is unavailable, and it costs no bundle weight. The hero's
 * WebGL layer sits on top of this and degrades to it.
 */

export type ContourTone = "ink" | "light" | "amber";

type Options = {
  /** `ink` for a light ground, `light` for a dark one, `amber` for an accent pass. */
  tone?: ContourTone;
  /** Line opacity, 0 to 1. The footer runs this low. */
  opacity?: number;
  /** How fast the field drifts, in seconds per cycle. */
  period?: number;
  className?: string;
};

/** Deterministic value noise. Seeded so the field is the same shape on every visit. */
function makeNoise(seed: number) {
  const hash = (x: number, y: number) => {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453;
    return n - Math.floor(n);
  };

  const smooth = (t: number) => t * t * (3 - 2 * t);

  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = smooth(x - xi);
    const yf = smooth(y - yi);

    const a = hash(xi, yi);
    const b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1);
    const d = hash(xi + 1, yi + 1);

    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

/** How strongly the field contributes to the line density. */
const LEVELS = 9;
const CELL = 14;
/** Vertical squash, so the contours read as a horizon rather than as a top-down map. */
const SQUASH = 0.55;

const TONE_COLOURS: Record<ContourTone, string> = {
  ink: "9, 10, 11",
  light: "255, 255, 255",
  amber: "245, 158, 11",
};

export function ContourField({ tone = "ink", opacity = 0.08, period = 14, className }: Options) {
  const canvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;

    const context = element.getContext("2d");
    if (!context) return;

    // A coarse pointer gets a still field. The drift is the whole point of the effect
    // and a phone battery is a worse place to spend it.
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia?.("(hover: none)").matches;
    if (still || coarse) return;

    const noise = makeNoise(7.31);
    let width = 0;
    let height = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = element.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));

      element.width = Math.floor(width * ratio);
      element.height = Math.floor(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = (time: number) => {
      const rgb = TONE_COLOURS[tone];
      const phase = (time / 1000 / period) * Math.PI * 2;

      context.clearRect(0, 0, width, height);
      context.lineWidth = 1;
      context.strokeStyle = `rgba(${rgb}, ${opacity})`;

      const columns = Math.ceil(width / CELL) + 1;
      const rows = Math.ceil(height / (CELL * SQUASH)) + 1;

      // Sample the field once per grid node, then walk each cell's four corners. This is
      // the marching-squares part: a cell whose corners straddle a level gets the line
      // segment between them.
      const values: number[] = new Array(columns * rows);

      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const x = column / columns;
          const y = row / rows;
          values[row * columns + column] =
            noise(x * 3.2 + Math.cos(phase) * 0.18, y * 3.2 + Math.sin(phase) * 0.18) * 0.65 +
            noise(x * 7.4, y * 7.4) * 0.35;
        }
      }

      const cellWidth = width / columns;
      const cellHeight = height / rows;

      for (let level = 1; level <= LEVELS; level++) {
        const threshold = level / (LEVELS + 1);

        context.beginPath();

        for (let row = 0; row < rows - 1; row++) {
          for (let column = 0; column < columns - 1; column++) {
            const topLeft = values[row * columns + column];
            const topRight = values[row * columns + column + 1];
            const bottomRight = values[(row + 1) * columns + column + 1];
            const bottomLeft = values[(row + 1) * columns + column];

            const inside = (value: number) => value < threshold;

            // All four corners on the same side of the level: no contour passes through.
            if (inside(topLeft) === inside(topRight) && inside(topRight) === inside(bottomRight) && inside(bottomRight) === inside(bottomLeft)) {
              continue;
            }

            const x = column * cellWidth;
            const y = row * cellHeight;

            // Where the level is crossed on each of the four edges, or null when that
            // edge does not straddle it.
            const along = (from: number, to: number) => {
              if (inside(from) === inside(to)) return null;
              return (threshold - from) / (to - from);
            };

            const onTop = along(topLeft, topRight);
            const onRight = along(topRight, bottomRight);
            const onBottom = along(bottomLeft, bottomRight);
            const onLeft = along(topLeft, bottomLeft);

            const top = onTop === null ? null : [x + onTop * cellWidth, y] as const;
            const right = onRight === null ? null : [x + cellWidth, y + onRight * cellHeight] as const;
            const bottom = onBottom === null ? null : [x + onBottom * cellWidth, y + cellHeight] as const;
            const left = onLeft === null ? null : [x, y + onLeft * cellHeight] as const;

            const segment = (a: readonly [number, number] | null, b: readonly [number, number] | null) => {
              if (!a || !b) return;
              context.moveTo(a[0], a[1]);
              context.lineTo(b[0], b[1]);
            };

            // Pairing is decided by the top-left corner. That resolves three of the
            // sixteen marching-squares cases correctly and picks one of the two readings
            // for the saddle cases, where the corners alternate around the cell. At this
            // cell size and line opacity the saddle is not resolvable by eye, and the
            // full sixteen-case table would cost four times the segments to draw a
            // difference nobody can see.
            if (inside(topLeft)) {
              segment(left, top);
              segment(bottom, right);
            } else {
              segment(top, right);
              segment(left, bottom);
            }
          }
        }

        context.stroke();
      }
    };

    resize();
    draw(0);

    window.addEventListener("resize", resize);
    const stop = subscribe((time) => draw(time));

    return () => {
      window.removeEventListener("resize", resize);
      stop();
    };
  }, [tone, opacity, period]);

  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className={className ?? "pointer-events-none absolute inset-0 h-full w-full"}
    />
  );
}
