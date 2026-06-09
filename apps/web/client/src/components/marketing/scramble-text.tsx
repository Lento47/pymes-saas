import { useScrambleText } from "@/hooks/use-scramble-text";

interface ScrambleTextProps {
  children: string;
  /** Total duration of the decode animation in ms (default 1200) */
  duration?: number;
  /** Delay before animation starts in ms (default 400) */
  delay?: number;
  className?: string;
}

/**
 * Renders text that "decodes" from random block characters (░▒▓█)
 * to the real text. Runs once on mount.
 *
 * Why "conversación": it's the core concept of PymesHub (conversational
 * operations) and sits in the most visually prominent position of the H1.
 */
export function ScrambleText({
  children,
  duration,
  delay,
  className,
}: ScrambleTextProps) {
  const display = useScrambleText(children, { duration, delay });

  return (
    <span
      className={className}
      aria-label={children}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {display.map((char, i) => (
        <span
          key={i}
          className="scramble-char"
          aria-hidden="true"
        >
          {char}
        </span>
      ))}
    </span>
  );
}
