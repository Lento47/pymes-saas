import { useState } from "react";
import { CheckCircle2, Mail, Shield, Trash2, Eye, Edit3, Download, MessageCircle } from "lucide-react";
import { Link } from "wouter";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { Footer } from "@/components/marketing/footer";
import { cn } from "@/lib/utils";

const ACCENT = "#F59E0B";

const REQUEST_TYPES = [
  {
    icon: Eye,
    title: "Acceder a mis datos",
    description: "Recibe una copia de los datos personales que PymesHub tiene registrados sobre ti.",
    id: "access",
  },
  {
    icon: Edit3,
    title: "Corregir mis datos",
    description: "Solicita la corrección de información incorrecta o desactualizada.",
    id: "correct",
  },
  {
    icon: Trash2,
    title: "Eliminar mis datos",
    description: "Solicita la eliminación de tus datos personales cuando ya no sean necesarios.",
    id: "delete",
  },
  {
    icon: Download,
    title: "Portabilidad",
    description: "Recibe tus datos en un formato estructurado para llevarlos a otro servicio.",
    id: "portability",
  },
  {
    icon: MessageCircle,
    title: "Revocar consentimiento",
    description: "Retira tu consentimiento para el tratamiento de tus datos personales.",
    id: "consent",
  },
];

export default function DataRequestPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", details: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#05091d] text-white">
      {/* Nav */}
      <header className="border-b border-white/10 bg-[#05091d] px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/"><BrandLockup compact textClassName="text-white" /></Link>
          <Link href="/legal" className="text-sm text-slate-400 hover:text-white transition">Centro Legal</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-16 md:px-8">
        <div className="mb-10 flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
            <Shield className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h1 className="font-marketing text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Gestión de Datos Personales
            </h1>
            <p className="mt-2 text-base text-slate-400">
              De acuerdo con la Ley N.º 8968 de Protección de la Persona frente al Tratamiento de sus Datos Personales (Costa Rica) y su Decreto Reglamentario N.º 37554-JP, tenés derecho a acceder, corregir, eliminar y gestionar tus datos personales.
            </p>
          </div>
        </div>

        {submitted ? (
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.07] p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400 mb-4" />
            <h2 className="font-marketing text-xl font-semibold text-white mb-2">Solicitud recibida</h2>
            <p className="text-sm text-slate-300 mb-6">
              Procesaremos tu solicitud dentro de los próximos <strong>15 días hábiles</strong>, de acuerdo con la normativa vigente. Recibirás una confirmación en el email que indicaste.
            </p>
            <button onClick={() => { setSubmitted(false); setSelected(null); setForm({ name: "", email: "", details: "" }); }}
              className="text-sm font-medium transition hover:opacity-80" style={{ color: ACCENT }}>
              Hacer otra solicitud
            </button>
          </div>
        ) : (
          <>
            {/* Request type selector */}
            <div className="mb-8">
              <h2 className="font-marketing text-base font-semibold text-white mb-4">¿Qué querés gestionar?</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {REQUEST_TYPES.map(({ icon: Icon, title, description, id }) => (
                  <button key={id} type="button" onClick={() => setSelected(id)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-4 text-left transition",
                      selected === id
                        ? "border-amber-500/50 bg-amber-500/[0.08]"
                        : "border-white/10 bg-white/[0.03] hover:border-white/25"
                    )}>
                    <div className={cn("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                      selected === id ? "bg-amber-500/15" : "bg-white/[0.06]")}>
                      <Icon className={cn("h-4 w-4", selected === id ? "text-amber-400" : "text-slate-400")} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            {selected && (
              <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
                <h3 className="font-marketing text-base font-semibold text-white">
                  {REQUEST_TYPES.find(r => r.id === selected)?.title}
                </h3>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Nombre completo</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/15"
                    placeholder="Tu nombre completo" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Email de tu cuenta</label>
                  <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/15"
                    placeholder="email@ejemplo.com" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Detalles adicionales <span className="text-slate-500">(opcional)</span></label>
                  <textarea value={form.details} onChange={e => setForm(f => ({ ...f, details: e.target.value }))}
                    rows={3}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/15 resize-none"
                    placeholder="Cualquier información adicional que quieras incluir..." />
                </div>
                <button type="submit"
                  className="w-full rounded-xl py-3 text-sm font-semibold text-[#05091d] transition hover:opacity-90"
                  style={{ background: ACCENT }}>
                  Enviar solicitud
                </button>
                <p className="text-xs text-slate-500 text-center">
                  También podés escribirnos directamente a{" "}
                  <a href="mailto:privacidad@pymeshub.lat" className="underline hover:text-slate-300">privacidad@pymeshub.lat</a>
                </p>
              </form>
            )}
          </>
        )}

        {/* Rights info */}
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="font-marketing text-sm font-semibold text-white mb-3">Tus derechos bajo la Ley 8968 (Costa Rica)</h3>
          <ul className="space-y-2">
            {[
              "Acceso: conocer qué datos tenemos y cómo los usamos",
              "Rectificación: corregir datos incorrectos o desactualizados",
              "Cancelación: solicitar la eliminación de tus datos",
              "Oposición: oponerte al procesamiento en ciertos casos",
              "Portabilidad: recibir tus datos en formato portable",
            ].map(r => (
              <li key={r} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-400" />
                <span className="text-sm text-slate-300">{r}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            Tiempo de respuesta: hasta 15 días hábiles. Si no recibís respuesta, podés presentar una reclamación ante la{" "}
            <a href="https://www.prodhab.go.cr" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">PRODHAB</a>.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
