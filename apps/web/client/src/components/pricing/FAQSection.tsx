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
        <div key={index} className="rounded-lg border border-gray-200 bg-white">
          <button
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-gray-50"
          >
            <h3 className="text-lg font-semibold text-gray-900">{faq.question}</h3>
            <ChevronDown
              className={`h-5 w-5 text-gray-600 transition-transform ${
                openIndex === index ? 'rotate-180' : ''
              }`}
            />
          </button>
          {openIndex === index && (
            <div className="border-t border-gray-200 px-6 py-4">
              <p className="text-gray-700">{faq.answer}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
