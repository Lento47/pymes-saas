import { useState } from "react";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2 } from "lucide-react";

const CATEGORIES = [
  { value: "alimentacion_bebidas",      emoji: "🍽", label: "Alimentación y bebidas" },
  { value: "servicios_profesionales",   emoji: "💼", label: "Servicios profesionales" },
  { value: "comercio_ventas",           emoji: "🛒", label: "Comercio y ventas" },
  { value: "salud_bienestar",           emoji: "🏥", label: "Salud y bienestar" },
  { value: "educacion_formacion",       emoji: "📚", label: "Educación y formación" },
  { value: "tecnologia_software",       emoji: "💻", label: "Tecnología y software" },
  { value: "construccion_remodelacion", emoji: "🔨", label: "Construcción y remodelación" },
  { value: "transporte_logistica",      emoji: "🚗", label: "Transporte y logística" },
  { value: "turismo_hospitalidad",      emoji: "🏨", label: "Turismo y hospitalidad" },
  { value: "belleza_estetica",          emoji: "✂️", label: "Belleza y estética" },
  { value: "entretenimiento_eventos",   emoji: "🎉", label: "Entretenimiento y eventos" },
  { value: "agropecuario",              emoji: "🌱", label: "Agropecuario" },
  { value: "servicios_hogar",           emoji: "🏠", label: "Servicios del hogar" },
  { value: "manufactura_artesania",     emoji: "⚙️", label: "Manufactura y artesanía" },
  { value: "bienes_raices",             emoji: "🏢", label: "Bienes raíces" },
  { value: "otro",                      emoji: "❓", label: "Otro" },
];

const TEAM_SIZES = [
  { value: "solo",    label: "Solo yo",             sub: "1 persona" },
  { value: "2_5",     label: "2 a 5 personas",      sub: "Pequeño equipo" },
  { value: "6_20",    label: "6 a 20 personas",     sub: "Equipo mediano" },
  { value: "20_plus", label: "Más de 20 personas",  sub: "Empresa grande" },
];

const CHANNELS = [
  { value: "redes_sociales", emoji: "📱", label: "Redes sociales",  sub: "Instagram, Facebook, TikTok" },
  { value: "whatsapp",       emoji: "💬", label: "WhatsApp",        sub: "Mensajería directa" },
  { value: "referidos",      emoji: "🤝", label: "Referidos",       sub: "Boca a boca" },
  { value: "local",          emoji: "🏪", label: "Local físico",    sub: "Tienda o negocio presencial" },
  { value: "web",            emoji: "🌐", label: "Sitio web",       sub: "Tienda en línea" },
  { value: "otro",           emoji: "➕", label: "Otro canal",      sub: "" },
];

const NEEDS = [
  { value: "facturacion",      emoji: "🧾", label: "Facturación electrónica", sub: "Hacienda CR" },
  { value: "atencion_cliente", emoji: "💬", label: "Atención al cliente",     sub: "Chats y mensajes" },
  { value: "ventas",           emoji: "📈", label: "Seguimiento de ventas",   sub: "CRM y pipeline" },
  { value: "pedidos",          emoji: "📦", label: "Pedidos y entregas",      sub: "Órdenes y logística" },
  { value: "inventario",       emoji: "📋", label: "Inventario",              sub: "Stock y productos" },
  { value: "citas",            emoji: "📅", label: "Citas y agenda",          sub: "Reservaciones" },
  { value: "cobros",           emoji: "💳", label: "Cobros y pagos",          sub: "Recordatorios y seguimiento" },
];

function MultiChip({ emoji, label, sub, selected, onClick }: {
  emoji: string; label: string; sub?: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "10px 14px",
        background: selected ? "hsl(var(--accent) / 0.1)" : "hsl(var(--bg))",
        border: `1.5px solid ${selected ? "hsl(var(--accent))" : "hsl(var(--border))"}`,
        borderRadius: "8px", cursor: "pointer", textAlign: "left", width: "100%",
        transition: "border-color 0.1s, background 0.1s",
      }}
    >
      <span style={{ fontSize: "20px", flexShrink: 0 }}>{emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 500, color: "hsl(var(--fg))" }}>{label}</div>
        {sub && <div style={{ fontSize: "11px", color: "hsl(var(--fg-2))", marginTop: "1px" }}>{sub}</div>}
      </div>
      {selected && <CheckCircle2 style={{ width: 16, height: 16, color: "hsl(var(--accent))", flexShrink: 0 }} />}
    </button>
  );
}

function RadioChip({ label, sub, selected, onClick }: {
  label: string; sub?: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
        padding: "10px 14px",
        background: selected ? "hsl(var(--accent) / 0.1)" : "hsl(var(--bg))",
        border: `1.5px solid ${selected ? "hsl(var(--accent))" : "hsl(var(--border))"}`,
        borderRadius: "8px", cursor: "pointer", textAlign: "left", width: "100%",
        transition: "border-color 0.1s, background 0.1s",
      }}
    >
      <div>
        <div style={{ fontSize: "13px", fontWeight: 500, color: "hsl(var(--fg))" }}>{label}</div>
        {sub && <div style={{ fontSize: "11px", color: "hsl(var(--fg-2))", marginTop: "1px" }}>{sub}</div>}
      </div>
      <div style={{
        width: 16, height: 16, borderRadius: "50%",
        border: `2px solid ${selected ? "hsl(var(--accent))" : "hsl(var(--border))"}`,
        background: selected ? "hsl(var(--accent))" : "transparent",
        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {selected && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
      </div>
    </button>
  );
}

export default function BusinessProfilePage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [step, setStep]             = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [teamSize, setTeamSize]     = useState("");
  const [channels, setChannels]     = useState<string[]>([]);
  const [needs, setNeeds]           = useState<string[]>([]);
  const [saving, setSaving]         = useState(false);

  const totalSteps = 4;

  const toggle = (arr: string[], set: (v: string[]) => void, val: string) =>
    set(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);

  const canNext = [
    categories.length > 0,
    teamSize !== "",
    channels.length > 0,
    needs.length > 0,
  ];

  const finish = async () => {
    setSaving(true);
    try {
      await api.saveBusinessProfile({ categories, team_size: teamSize, channels, needs });
      navigate("/");
    } catch {
      toast({ title: "No se pudo guardar el perfil", description: "Intente nuevamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const STEPS = [
    {
      title: "¿En qué sector opera su negocio?",
      sub:   "Seleccione todas las que apliquen",
      content: CATEGORIES.map(c => (
        <MultiChip key={c.value} emoji={c.emoji} label={c.label}
          selected={categories.includes(c.value)}
          onClick={() => toggle(categories, setCategories, c.value)} />
      )),
    },
    {
      title: "¿Cuántas personas trabajan en su negocio?",
      sub:   "Seleccione una opción",
      content: TEAM_SIZES.map(t => (
        <RadioChip key={t.value} label={t.label} sub={t.sub}
          selected={teamSize === t.value}
          onClick={() => setTeamSize(t.value)} />
      )),
    },
    {
      title: "¿Cómo llegan sus clientes principalmente?",
      sub:   "Seleccione todos los que apliquen",
      content: CHANNELS.map(c => (
        <MultiChip key={c.value} emoji={c.emoji} label={c.label} sub={c.sub}
          selected={channels.includes(c.value)}
          onClick={() => toggle(channels, setChannels, c.value)} />
      )),
    },
    {
      title: "¿Qué necesita gestionar con PymesHub?",
      sub:   "Seleccione las herramientas que más necesita",
      content: NEEDS.map(n => (
        <MultiChip key={n.value} emoji={n.emoji} label={n.label} sub={n.sub}
          selected={needs.includes(n.value)}
          onClick={() => toggle(needs, setNeeds, n.value)} />
      )),
    },
  ];

  const s = STEPS[step];

  return (
    <div style={{
      minHeight: "100vh", background: "hsl(var(--bg))",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "40px 24px",
    }}>
      <div style={{ width: "100%", maxWidth: "520px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "28px", height: "28px", background: "hsl(var(--accent))", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: "11px", fontWeight: 700 }}>P</span>
            </div>
            <span style={{ fontSize: "15px", fontWeight: 600, color: "hsl(var(--fg))" }}>Pymeshub</span>
          </div>
          <span style={{ fontSize: "12px", color: "hsl(var(--fg-2))" }}>Paso {step + 1} de {totalSteps}</span>
        </div>

        <div style={{ height: "4px", background: "hsl(var(--border))", borderRadius: "2px", marginBottom: "28px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${((step + 1) / totalSteps) * 100}%`, background: "hsl(var(--accent))", borderRadius: "2px", transition: "width 0.3s ease" }} />
        </div>

        <h2 style={{ fontSize: "18px", fontWeight: 600, color: "hsl(var(--fg))", marginBottom: "4px", letterSpacing: "-0.01em" }}>{s.title}</h2>
        <p style={{ fontSize: "13px", color: "hsl(var(--fg-2))", marginBottom: "20px" }}>{s.sub}</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{s.content}</div>

        <div style={{ display: "flex", gap: "10px", marginTop: "24px", alignItems: "center" }}>
          {step > 0 && (
            <button type="button" onClick={() => setStep(s => s - 1)} style={{ height: "32px", padding: "0 16px", background: "transparent", border: "1px solid hsl(var(--border))", borderRadius: "4px", fontSize: "13px", color: "hsl(var(--fg))", cursor: "pointer" }}>
              Atrás
            </button>
          )}

          {step < totalSteps - 1 ? (
            <button type="button" onClick={() => setStep(s => s + 1)} disabled={!canNext[step]} style={{ height: "32px", padding: "0 20px", background: canNext[step] ? "hsl(var(--accent))" : "hsl(var(--border))", color: canNext[step] ? "#fff" : "hsl(var(--fg-2))", border: "none", borderRadius: "4px", fontSize: "13px", fontWeight: 500, cursor: canNext[step] ? "pointer" : "not-allowed" }}>
              Continuar
            </button>
          ) : (
            <button type="button" onClick={finish} disabled={!canNext[step] || saving} style={{ height: "32px", padding: "0 20px", background: (!canNext[step] || saving) ? "hsl(var(--accent) / 0.7)" : "hsl(var(--accent))", color: "#fff", border: "none", borderRadius: "4px", fontSize: "13px", fontWeight: 500, cursor: (!canNext[step] || saving) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
              {saving && <Loader2 className="animate-spin" style={{ width: 13, height: 13 }} />}
              Finalizar
            </button>
          )}

          <button type="button" onClick={() => navigate("/")} style={{ marginLeft: "auto", height: "32px", padding: "0 12px", background: "transparent", border: "none", fontSize: "12px", color: "hsl(var(--fg-2))", cursor: "pointer", textDecoration: "underline" }}>
            Saltar por ahora
          </button>
        </div>
      </div>
    </div>
  );
}