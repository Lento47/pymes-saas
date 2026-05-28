import { motion } from "framer-motion";

interface TextEffectProps {
  words: string;
  className?: string;
  filter?: boolean;
  duration?: number;
}

export function TextEffect({ words, className, filter = true, duration = 0.4 }: TextEffectProps) {
  const wordsArray = words.split(" ");
  return (
    <motion.span className={className} initial="hidden" animate="visible">
      {wordsArray.map((word, idx) => (
        <motion.span
          key={idx}
          className="inline-block mr-[0.25em]"
          variants={{
            hidden: { opacity: 0, y: 12, filter: filter ? "blur(6px)" : "none" },
            visible: {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              transition: { duration, delay: idx * 0.06, ease: [0.22, 1, 0.36, 1] },
            },
          }}
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
}
