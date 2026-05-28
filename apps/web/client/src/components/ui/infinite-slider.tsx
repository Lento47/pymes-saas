import { useRef } from "react";
import { motion, useAnimationFrame, useMotionValue } from "framer-motion";

interface InfiniteSliderProps {
  children: React.ReactNode;
  duration?: number;
  gap?: number;
  reverse?: boolean;
}

export function InfiniteSlider({ children, duration = 25, gap = 24, reverse = false }: InfiniteSliderProps) {
  const x = useMotionValue(0);
  const ref = useRef<HTMLDivElement>(null);

  useAnimationFrame((t) => {
    if (!ref.current) return;
    const width = ref.current.scrollWidth / 2;
    const speed = width / (duration * 1000);
    const raw = (t * speed) % width;
    x.set(reverse ? raw - width : -raw);
  });

  return (
    <div
      className="overflow-hidden"
      style={{ maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)" }}
    >
      <motion.div ref={ref} className="flex" style={{ x, gap }}>
        {children}
        {children}
      </motion.div>
    </div>
  );
}
