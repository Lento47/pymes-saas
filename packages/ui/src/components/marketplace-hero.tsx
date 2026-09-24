import { ArrowUpRight, MapPin, ShoppingBag, Store } from "lucide-react";
import type { ReactNode } from "react";

/** The marketplace's visual anchor; all colours and corners use shared tokens. */
export function MarketplaceHero({eyebrow,title,description,action,delivery,pickup}:{eyebrow:string;title:string;description:string;action:ReactNode;delivery:string;pickup:string}) {
 return <section className="relative isolate overflow-hidden rounded-lg bg-foreground px-6 py-9 text-background sm:px-10 sm:py-12">
  <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-20 size-80 rounded-full border-[40px] border-background/5" />
  <div className="relative grid items-center gap-8 sm:grid-cols-[1fr_auto]">
   <div className="max-w-xl"><p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest"><MapPin aria-hidden="true" className="size-4" />{eyebrow}</p><h1 className="text-balance font-heading text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{title}</h1><p className="mt-4 max-w-md text-pretty text-base leading-relaxed text-background/80">{description}</p><div className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-background px-5 font-semibold text-foreground">{action}<ArrowUpRight aria-hidden="true" className="size-4" /></div></div>
   <div className="flex gap-3 sm:flex-col"><div className="flex items-center gap-3 rounded-md border border-background/15 px-4 py-3"><ShoppingBag aria-hidden="true" className="size-6" /><span className="text-sm font-medium">{delivery}</span></div><div className="flex items-center gap-3 rounded-md border border-background/15 px-4 py-3"><Store aria-hidden="true" className="size-6" /><span className="text-sm font-medium">{pickup}</span></div></div>
  </div>
 </section>;
}
