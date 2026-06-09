import { useScrambleText } from "@/hooks/use-scramble-text";

interface ScrambleTextProps {
  children: string;
  duration?: number;
  delay?: number;
  className?: string;
}

/**
 * Renders text that "decodes" from random block characters (░▒▓█)
 * to the real text. Resolves left-to-right with terminal aesthetics.
 * Runs once on mount. Respects prefers-reduced-motion.
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
  const { display } = useScrambleText(children, { duration, delay });

  return (
    <span
      className={className}
      aria-label={children}
      role="text"
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {display.map((item, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={item.resolved ? "scramble-resolved" : "scramble-active"}
        >
          {item.char}
        </span>
      ))}
    </span>
  );
}
