import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQProps {
  items: FAQItem[];
}

export function FAQ({ items }: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {items.map((item, index) => (
        <button
          key={index}
          onClick={() => setOpenIndex(openIndex === index ? null : index)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-6 py-4 text-left transition-all duration-300 hover:border-white/20 hover:bg-white/[0.04]"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">{item.question}</h3>
            <ChevronDown
              className={cn(
                "h-5 w-5 transition-transform duration-300",
                openIndex === index ? "rotate-180 text-[#dfff4a]" : "text-white/40"
              )}
            />
          </div>
          {openIndex === index && (
            <p className="mt-4 text-sm leading-relaxed text-white/70">{item.answer}</p>
          )}
        </button>
      ))}
    </div>
  );
}
