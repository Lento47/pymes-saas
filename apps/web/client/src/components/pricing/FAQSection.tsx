import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FAQ } from '@/data/pricing.data';

interface FAQSectionProps {
  faqs: FAQ[];
}

export function FAQSection({ faqs }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {faqs.map((faq, index) => (
        <div key={index} className="rounded-lg border border-indigo-400/20 bg-indigo-900/20">
          <button
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            className="flex w-full items-center justify-between px-3 sm:px-6 py-2 sm:py-4 text-left hover:bg-indigo-900/30 transition-colors"
          >
            <h3 className="text-lg font-semibold text-white">{faq.question}</h3>
            <ChevronDown
              className={`h-5 w-5 text-white/75 transition-transform ${
                openIndex === index ? 'rotate-180' : ''
              }`}
            />
          </button>
          {openIndex === index && (
            <div className="border-t border-indigo-400/20 px-3 sm:px-6 py-2 sm:py-4">
              <p className="text-white/85">{faq.answer}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
