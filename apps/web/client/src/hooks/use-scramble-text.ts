import { useEffect, useRef, useState, useCallback } from "react";

const BLOCKS = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","0","1","2","3","4","5","6","7","8","9"];

export const BLOCK_CHARS = ["█","▓","▒","░","▇","▆","▅","▄","▌","▐","▍","▎"];

interface ScrambleOptions {
  duration?: number;
  delay?: number;
  chars?: string[];
}

interface ScrambleChar {
  char: string;
  resolved: boolean;
}

/**
 * Returns an array of ScrambleChar objects that animate from random block
 * characters to the real target text, resolving left-to-right with slight
 * random jitter. Runs once on mount. Respects prefers-reduced-motion.
 */
export function useScrambleText(target: string, options: ScrambleOptions = {}) {
  const { duration = 1400, delay = 300, chars = BLOCKS } = options;

  const [display, setDisplay] = useState<ScrambleChar[]>(() =>
    target.split("").map((ch) => ({
      char: ch === " " ? " " : chars[Math.floor(Math.random() * chars.length)],
      resolved: ch === " ",
    })),
  );
  const [done, setDone] = useState(false);

  const rafRef = useRef<number>(0);
  const timeoutRef = useRef<number | NodeJS.Timeout | null>(null);
  const startedRef = useRef(false);

  const scramble = useCallback(() => {
    if (!target) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      setDisplay(target.split("").map((ch) => ({ char: ch, resolved: true })));
      setDone(true);
      return;
    }

    if (startedRef.current) return;
    startedRef.current = true;
    setDone(false);

    const letters = target.split("");
    const total = letters.length;
    const baseStep = duration / (total + 4);

    const resolveAt = letters.map((_, i) => {
      const base = i * baseStep;
      const jitter = (Math.random() - 0.5) * baseStep * 1.2;
      return Math.max(0, Math.min(duration, base + jitter));
    });

    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;

      const next: ScrambleChar[] = letters.map((real, i) => {
        if (real === " " || elapsed >= resolveAt[i]) {
          return { char: real, resolved: true };
        }
        const cycleSpeed = 50 + Math.random() * 30;
        const cycleIndex =
          Math.floor((elapsed + i * 17) / cycleSpeed) % chars.length;
        return { char: chars[cycleIndex], resolved: false };
      });

      setDisplay(next);

      if (elapsed < duration) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDone(true);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [target, duration, chars]);

  useEffect(() => {
    startedRef.current = false;
    setDone(false);
    setDisplay(
      target.split("").map((ch) => ({
        char: ch === " " ? " " : chars[Math.floor(Math.random() * chars.length)],
        resolved: ch === " ",
      })),
    );

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(scramble, delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, [target, delay, scramble, chars]);

  return { display, done };
}
