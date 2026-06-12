import { useScrambleText } from "@/hooks/use-scramble-text";

interface ScrambleTextProps {
  children: string;
  duration?: number;
  delay?: number;
  className?: string;
  chars?: string[];
}

export function ScrambleText({
  children,
  duration,
  delay,
  className,
  chars,
}: ScrambleTextProps) {
  const { display } = useScrambleText(children, { duration, delay, chars });

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
