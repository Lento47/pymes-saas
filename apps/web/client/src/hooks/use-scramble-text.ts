import { useEffect, useRef, useState, useCallback } from "react";

const BLOCKS = ["░", "▒", "▓", "█", "▇", "▆", "▅", "▄", "▌", "▐"];

interface ScrambleOptions {
  /** Total duration of the decode animation in ms (default 1200) */
  duration?: number;
  /** Delay before animation starts in ms (default 400) */
  delay?: number;
  /** Characters to scramble with (default BLOCKS) */
  chars?: string[];
}

/**
 * Returns an array of characters that resolves from random block characters
 * to the real target text over time. Each position locks in independently.
 * Runs once on mount — no repetition.
 */
export function useScrambleText(target: string, options: ScrambleOptions = {}) {
  const { duration = 1200, delay = 400, chars = BLOCKS } = options;
  const [display, setDisplay] = useState(() => target.split(""));
  const rafRef = useRef<number>(0);
  const startedRef = useRef(false);

  const scramble = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const letters = target.split("");

    // Each position gets a random resolve time within [0, duration]
    const resolveAt = letters.map(() => Math.random() * duration);

    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const next = letters.map((real, i) => {
        if (elapsed >= resolveAt[i]) return real;
        return chars[Math.floor(Math.random() * chars.length)];
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
