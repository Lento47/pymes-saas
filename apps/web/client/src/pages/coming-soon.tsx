import { Link } from "wouter";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { Footer } from "@/components/marketing/footer";

const ACCENT = "#F59E0B";

interface ComingSoonPageProps {
  eyebrow: string;
  title: string;
  description: string;
}

export default function ComingSoonPage({ eyebrow, title, description }: ComingSoonPageProps) {
  return (
    <div className="min-h-screen bg-[#05091d] text-white flex flex-col">
      <header className="border-b border-white/10 bg-[#05091d] px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/"><BrandLockup compact textClassName="text-white" /></Link>
          <Link href="/" className="text-sm text-slate-400 hover:text-white transition">Inicio</Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="max-w-2xl w-full text-center">
          <span
            className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-6"
            style={{ background: "rgba(245,158,11,0.12)", color: ACCENT }}
          >
            {eyebrow}
          </span>
          <h1 className="font-marketing text-3xl font-bold tracking-tight text-white sm:text-4xl mb-5">
            {title}
          </h1>
          <p className="text-base text-slate-400 leading-relaxed mb-10 max-w-lg mx-auto">
            {description}
          </p>
          <p className="text-sm font-medium mb-8" style={{ color: ACCENT }}>
            Próximamente
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/[0.08] hover:text-white transition"
          >
            ← Volver al inicio
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
