import { Link } from "wouter";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { Footer } from "@/components/marketing/footer";

const ACCENT = "#6757E8";

interface ComingSoonPageProps {
  eyebrow: string;
  title: string;
  description: string;
}

export default function ComingSoonPage({ eyebrow, title, description }: ComingSoonPageProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/"><BrandLockup compact /></Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition">Inicio</Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="max-w-2xl w-full text-center">
          <span
            className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-6"
            style={{ background: `${ACCENT}18`, color: ACCENT }}
          >
            {eyebrow}
          </span>
          <h1 className="font-marketing text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-5">
            {title}
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed mb-10 max-w-lg mx-auto">
            {description}
          </p>
          <p className="text-sm font-medium mb-8" style={{ color: ACCENT }}>
            Próximamente
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:border-border/80 hover:text-foreground transition"
          >
            ← Volver al inicio
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
