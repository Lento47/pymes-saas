import { useEffect, useRef, useState, useCallback } from "react";

const BLOCKS = ["░", "▒", "▓", "█", "▇", "▆", "▅", "▄", "▌", "▐"];

interface ScrambleOptions {
  /** Total duration of the decode animation in ms (default 1400) */
  duration?: number;
  /** Delay before animation starts in ms (default 300) */
  delay?: number;
  /** Characters to scramble with */
  chars?: string[];
}

interface ScrambleChar {
  /** The character to display (block or real letter) */
  char: string;
  /** Whether this position has resolved to the real letter */
  resolved: boolean;
}

/**
 * Returns an array of ScrambleChar objects that animate from random block
 * characters to the real target text, resolving left-to-right with slight
 * random jitter. Runs once on mount.
 */
export function useScrambleText(target: string, options: ScrambleOptions = {}) {
  const { duration = 1400, delay = 300, chars = BLOCKS } = options;

  const [display, setDisplay] = useState<ScrambleChar[]>(() =>
    target.split("").map(() => ({ char: chars[0], resolved: false })),
  );

  const rafRef = useRef<number>(0);
  const startedRef = useRef(false);

  const scramble = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const letters = target.split("");
    const total = letters.length;

    // Each position gets a resolve time based on its index (left-to-right)
    // with random jitter so it's not perfectly sequential
    const baseStep = duration / (total + 4); // extra slots for jitter room
    const resolveAt = letters.map((_, i) => {
      const base = i * baseStep;
      const jitter = (Math.random() - 0.5) * baseStep * 1.2;
      return Math.max(0, Math.min(duration, base + jitter));
    });

    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const next: ScrambleChar[] = letters.map((real, i) => {
        if (elapsed >= resolveAt[i]) {
          return { char: real, resolved: true };
        }
        // Cycle through block characters while unresolved
        const cycleSpeed = 50 + Math.random() * 30; // ms per cycle
        const cycleIndex = Math.floor((elapsed + i * 17) / cycleSpeed) % chars.length;
        return { char: chars[cycleIndex], resolved: false };
      });
      setDisplay(next);

      if (elapsed < duration) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [target, duration, chars]);

  useEffect(() => {
    const timer = setTimeout(scramble, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(rafRef.current);
    };
  }, [scramble, delay]);

  return display;
}
