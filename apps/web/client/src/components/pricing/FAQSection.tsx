import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { FAQ } from '@/data/pricing.data';

interface FAQSectionProps {
  faqs: FAQ[];
}

export function FAQSection({ faqs }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {faqs.map((faq, index) => (
        <div key={index} className="rounded-lg border border-border bg-card">
          <button
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-muted/35 sm:px-6 sm:py-4"
          >
            <h3 className="text-lg font-semibold text-foreground">{faq.question}</h3>
            <ChevronDown
              className={`h-5 w-5 text-muted-foreground transition-transform ${
                openIndex === index ? 'rotate-180' : ''
              }`}
            />
          </button>
          {openIndex === index && (
            <div className="border-t border-border px-3 py-2 sm:px-6 sm:py-4">
              <p className="text-muted-foreground">{faq.answer}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
