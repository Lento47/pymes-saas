import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Eye, Globe, Image, LayoutTemplate, Loader2, Plus, Save, Trash2, Type,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type LandingConfig = {
  enabled?: boolean;
  tweaks?: {
    hero?: string;
    testimonials?: string;
    pricing?: string;
    accent?: string;
    background?: string;
  };
  nav?: { cta?: string };
  sections?: {
    hero?: { chip?: string; title?: string; titleHighlight?: string; subtitle?: string; cta1Label?: string; cta2Label?: string };
    howItWorks?: Array<{ number?: string; title?: string; description?: string }>;
    benefits?: Array<{ title?: string; description?: string }>;
    testimonials?: Array<{ quote?: string; name?: string; role?: string; location?: string; avatarInitials?: string; avatarColor1?: string; avatarColor2?: string; avatarImageUrl?: string }>;
    pricing?: Array<{ name?: string; price?: string; description?: string; cta?: string; highlight?: boolean; features?: string[] }>;
    faq?: Array<{ question?: string; answer?: string }>;
    socialProof?: { title?: string; stats?: Array<{ number?: string; label?: string }> };
  };
  media?: { heroImageUrl?: string; logoUrl?: string };
};

// ── Shared primitives ─────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, padding: 20, ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontWeight: 600, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", color: "hsl(var(--muted-foreground))", marginBottom: 14 }}>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, textarea }: { value: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean }) {
  const shared = {
    background: "hsl(var(--background))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 6,
    padding: "7px 10px",
    fontSize: 13,
    color: "hsl(var(--foreground))",
    width: "100%",
    outline: "none",
  } as React.CSSProperties;
  return textarea
    ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...shared, minHeight: 72, resize: "vertical" }} />
    : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={shared} />;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 40, height: 22, borderRadius: 11,
          background: checked ? "hsl(var(--primary))" : "hsl(var(--border))",
          position: "relative", transition: "background .2s", cursor: "pointer",
        }}
      >
        <div style={{
          width: 16, height: 16, borderRadius: "50%", background: "#fff",
          position: "absolute", top: 3, left: checked ? 21 : 3, transition: "left .2s",
        }} />
      </div>
      <span style={{ fontSize: 14 }}>{label}</span>
    </label>
  );
}

function Btn({ children, onClick, variant = "primary", disabled, style }: {
  children: React.ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger"; disabled?: boolean; style?: React.CSSProperties;
}) {
  const bg = variant === "primary" ? "hsl(var(--primary))" : variant === "danger" ? "hsl(0 72% 51%)" : "transparent";
  const color = variant === "ghost" ? "hsl(var(--foreground))" : "#fff";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: bg, color, border: variant === "ghost" ? "1px solid hsl(var(--border))" : "none",
        borderRadius: 7, padding: "7px 14px", fontSize: 13, fontWeight: 500,
        cursor: disabled ? "not-allowed", opacity: disabled ? 0.5 : 1,
        ...style,
      } as React.CSSProperties}
    >
      {children}
    </button>
  );
}

function RadioGroup({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Field label={label}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {options.map(o => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              padding: "5px 12px", borderRadius: 6, fontSize: 13, cursor: "pointer",
              background: value === o.value ? "hsl(var(--primary))" : "hsl(var(--background))",
              color: value === o.value ? "#fff" : "hsl(var(--foreground))",
              border: `1px solid ${value === o.value ? "hsl(var(--primary))" : "hsl(var(--border))"}`,
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

// ── Accordion item (for content sections) ─────────────────────────────────────

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 16px", background: "hsl(var(--card))", border: "none", cursor: "pointer",
          fontSize: 14, fontWeight: 500, color: "hsl(var(--foreground))",
        }}
      >
        {title}
        <span style={{ fontSize: 18, color: "hsl(var(--muted-foreground))" }}>{open ? "−" : "+"}</span>
      </button>
      {open && <div style={{ padding: "16px", borderTop: "1px solid hsl(var(--border))", display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>}
    </div>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

type Tab = "general" | "content" | "images" | "preview";

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: "General", icon: <Globe size={14} /> },
    { id: "content", label: "Contenido", icon: <Type size={14} /> },
    { id: "images", label: "Imágenes", icon: <Image size={14} /> },
    { id: "preview", label: "Vista previa", icon: <Eye size={14} /> },
  ];
  return (
    <div style={{ display: "flex", gap: 4, borderBottom: "1px solid hsl(var(--border))", marginBottom: 24 }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "10px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer",
            background: "transparent", border: "none",
            borderBottom: active === t.id ? "2px solid hsl(var(--primary))" : "2px solid transparent",
            color: active === t.id ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
            marginBottom: -1,
          }}
        >
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Image upload field ────────────────────────────────────────────────────────

function ImageUploadField({ label, currentUrl, onUploaded }: {
  label: string; currentUrl?: string; onUploaded: (url: string, key: string) => void;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await api.uploadLandingImage(fd);
      onUploaded(res.url, res.key);
      toast({ title: "Imagen subida" });
    } catch {
      toast({ title: "Error al subir imagen", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Field label={label}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {currentUrl && (
          <img src={currentUrl} alt="" style={{ width: 80, height: 50, objectFit: "cover", borderRadius: 6, border: "1px solid hsl(var(--border))" }} />
        )}
        <Btn variant="ghost" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Image size={14} />}
          {uploading ? "Subiendo…" : "Subir imagen"}
        </Btn>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>
    </Field>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LandingEditor() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("general");
  const [draft, setDraft] = useState<LandingConfig>({});

  const { data, isLoading } = useQuery({
    queryKey: ["landing-config"],
    queryFn: () => api.getLandingConfig(),
  });

  useEffect(() => {
    if (data) setDraft(data as LandingConfig);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.updateLandingConfig(draft as Record<string, any>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["landing-config"] });
      toast({ title: "Cambios guardados" });
    },
    onError: () => toast({ title: "Error al guardar", variant: "destructive" }),
  });

  const set = (path: string[], value: any) => {
    setDraft(prev => {
      const next = structuredClone(prev);
      let cur: any = next;
      for (let i = 0; i < path.length - 1; i++) {
        if (!cur[path[i]]) cur[path[i]] = {};
        cur = cur[path[i]];
      }
      cur[path[path.length - 1]] = value;
      return next;
    });
  };

  const setArr = (path: string[], index: number, field: string, value: any) => {
    setDraft(prev => {
      const next = structuredClone(prev);
      let cur: any = next;
      for (const key of path) {
        if (!cur[key]) cur[key] = [];
        cur = cur[key];
      }
      if (!cur[index]) cur[index] = {};
      cur[index][field] = value;
      return next;
    });
  };

  const addToArr = (path: string[], template: Record<string, any>) => {
    setDraft(prev => {
      const next = structuredClone(prev);
      let cur: any = next;
      for (let i = 0; i < path.length - 1; i++) {
        if (!cur[path[i]]) cur[path[i]] = {};
        cur = cur[path[i]];
      }
      const last = path[path.length - 1];
      if (!cur[last]) cur[last] = [];
      cur[last].push({ ...template });
      return next;
    });
  };

  const removeFromArr = (path: string[], index: number) => {
    setDraft(prev => {
      const next = structuredClone(prev);
      let cur: any = next;
      for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]] ?? {};
      const last = path[path.length - 1];
      if (Array.isArray(cur[last])) cur[last].splice(index, 1);
      return next;
    });
  };

  if (isLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <Loader2 size={24} className="animate-spin" style={{ color: "hsl(var(--muted-foreground))" }} />
    </div>
  );

  const t = draft.tweaks ?? {};
  const sections = draft.sections ?? {};
  const media = draft.media ?? {};

  return (
    <div style={{ padding: "28px 32px", maxWidth: 980, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Editor del Landing Page</h1>
          <p style={{ margin: "6px 0 0", color: "hsl(var(--muted-foreground))", fontSize: 14 }}>
            Configura el contenido y diseño del landing page público de PymesHub.
          </p>
        </div>
        <Btn onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar cambios
        </Btn>
      </div>

      <TabBar active={tab} onChange={setTab} />

      {/* ── TAB: General ── */}
      {tab === "general" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <SectionTitle>Estado</SectionTitle>
            <Toggle
              checked={draft.enabled ?? true}
              onChange={v => set(["enabled"], v)}
              label={draft.enabled ?? true ? "Landing activo — visible para todos" : "Landing desactivado — muestra página de mantenimiento"}
            />
          </Card>

          <Card>
            <SectionTitle>Diseño</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <RadioGroup
                label="Variante del Hero"
                value={t.hero ?? "illustration"}
                onChange={v => set(["tweaks", "hero"], v)}
                options={[{ value: "illustration", label: "3D" }, { value: "product", label: "UI" }, { value: "minimal", label: "Texto" }]}
              />
              <RadioGroup
                label="Testimoniales"
                value={t.testimonials ?? "cards"}
                onChange={v => set(["tweaks", "testimonials"], v)}
                options={[{ value: "cards", label: "Tarjetas" }, { value: "hero", label: "Destacado" }]}
              />
              <RadioGroup
                label="Precios"
                value={t.pricing ?? "cards"}
                onChange={v => set(["tweaks", "pricing"], v)}
                options={[{ value: "cards", label: "Tarjetas" }, { value: "table", label: "Tabla" }]}
              />
              <RadioGroup
                label="Fondo"
                value={t.background ?? "white"}
                onChange={v => set(["tweaks", "background"], v)}
                options={[{ value: "white", label: "Blanco" }, { value: "warm", label: "Cálido" }]}
              />
              <Field label="Color de acento">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="color"
                    value={t.accent ?? "#4F46E5"}
                    onChange={e => set(["tweaks", "accent"], e.target.value)}
                    style={{ width: 44, height: 36, border: "1px solid hsl(var(--border))", borderRadius: 6, cursor: "pointer", padding: 2 }}
                  />
                  <span style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>{t.accent ?? "#4F46E5"}</span>
                </div>
              </Field>
            </div>
          </Card>

          <Card>
            <SectionTitle>Navegación</SectionTitle>
            <Field label="Texto del CTA principal">
              <Input value={draft.nav?.cta ?? ""} onChange={v => set(["nav", "cta"], v)} placeholder="Solicitar demo" />
            </Field>
          </Card>
        </div>
      )}

      {/* ── TAB: Contenido ── */}
      {tab === "content" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {/* Hero */}
          <Accordion title="Hero">
            <Field label="Chip/Eyebrow"><Input value={sections.hero?.chip ?? ""} onChange={v => set(["sections", "hero", "chip"], v)} placeholder="Nuevo en v2.0 · IA integrada" /></Field>
            <Field label="Título"><Input value={sections.hero?.title ?? ""} onChange={v => set(["sections", "hero", "title"], v)} placeholder="El sistema operativo de tu negocio" /></Field>
            <Field label="Parte destacada del título"><Input value={sections.hero?.titleHighlight ?? ""} onChange={v => set(["sections", "hero", "titleHighlight"], v)} placeholder="negocio" /></Field>
            <Field label="Subtítulo"><Input textarea value={sections.hero?.subtitle ?? ""} onChange={v => set(["sections", "hero", "subtitle"], v)} placeholder="Centraliza WhatsApp, email, CRM…" /></Field>
            <Field label="CTA primario"><Input value={sections.hero?.cta1Label ?? ""} onChange={v => set(["sections", "hero", "cta1Label"], v)} placeholder="Empezar gratis" /></Field>
            <Field label="CTA secundario"><Input value={sections.hero?.cta2Label ?? ""} onChange={v => set(["sections", "hero", "cta2Label"], v)} placeholder="Ver demo" /></Field>
          </Accordion>

          {/* Social Proof */}
          <Accordion title="Prueba social">
            <Field label="Título de la sección"><Input value={sections.socialProof?.title ?? ""} onChange={v => set(["sections", "socialProof", "title"], v)} placeholder="Usado por negocios que crecen" /></Field>
            <SectionTitle>Estadísticas</SectionTitle>
            {(sections.socialProof?.stats ?? []).map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Input value={s.number ?? ""} onChange={v => setArr(["sections", "socialProof", "stats"], i, "number", v)} placeholder="12,400+" />
                <Input value={s.label ?? ""} onChange={v => setArr(["sections", "socialProof", "stats"], i, "label", v)} placeholder="conversaciones al día" />
                <button onClick={() => removeFromArr(["sections", "socialProof", "stats"], i)} style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(0 72% 51%)" }}><Trash2 size={14} /></button>
              </div>
            ))}
            <Btn variant="ghost" onClick={() => addToArr(["sections", "socialProof", "stats"], { number: "", label: "" })}><Plus size={14} /> Agregar estadística</Btn>
          </Accordion>

          {/* How It Works */}
          <Accordion title="Cómo funciona">
            {(sections.howItWorks ?? []).map((s, i) => (
              <div key={i} style={{ padding: "12px", background: "hsl(var(--background))", borderRadius: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: 600, fontSize: 13 }}>Paso {s.number ?? i + 1}</span><button onClick={() => removeFromArr(["sections", "howItWorks"], i)} style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(0 72% 51%)" }}><Trash2 size={14} /></button></div>
                <Field label="Número"><Input value={s.number ?? ""} onChange={v => setArr(["sections", "howItWorks"], i, "number", v)} placeholder="01" /></Field>
                <Field label="Título"><Input value={s.title ?? ""} onChange={v => setArr(["sections", "howItWorks"], i, "title", v)} placeholder="Conecta tus canales" /></Field>
                <Field label="Descripción"><Input textarea value={s.description ?? ""} onChange={v => setArr(["sections", "howItWorks"], i, "description", v)} /></Field>
              </div>
            ))}
            <Btn variant="ghost" onClick={() => addToArr(["sections", "howItWorks"], { number: "", title: "", description: "" })}><Plus size={14} /> Agregar paso</Btn>
          </Accordion>

          {/* Benefits */}
          <Accordion title="Beneficios">
            {(sections.benefits ?? []).map((b, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <Input value={b.title ?? ""} onChange={v => setArr(["sections", "benefits"], i, "title", v)} placeholder="Título" />
                  <Input textarea value={b.description ?? ""} onChange={v => setArr(["sections", "benefits"], i, "description", v)} placeholder="Descripción" />
                </div>
                <button onClick={() => removeFromArr(["sections", "benefits"], i)} style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(0 72% 51%)", marginTop: 4 }}><Trash2 size={14} /></button>
              </div>
            ))}
            <Btn variant="ghost" onClick={() => addToArr(["sections", "benefits"], { title: "", description: "" })}><Plus size={14} /> Agregar beneficio</Btn>
          </Accordion>

          {/* Testimonials */}
          <Accordion title="Testimonios">
            {(sections.testimonials ?? []).map((t, i) => (
              <div key={i} style={{ padding: 12, background: "hsl(var(--background))", borderRadius: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontWeight: 600, fontSize: 13 }}>Testimonio {i + 1}</span><button onClick={() => removeFromArr(["sections", "testimonials"], i)} style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(0 72% 51%)" }}><Trash2 size={14} /></button></div>
                <Field label="Cita"><Input textarea value={t.quote ?? ""} onChange={v => setArr(["sections", "testimonials"], i, "quote", v)} /></Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <Field label="Nombre"><Input value={t.name ?? ""} onChange={v => setArr(["sections", "testimonials"], i, "name", v)} /></Field>
                  <Field label="Rol"><Input value={t.role ?? ""} onChange={v => setArr(["sections", "testimonials"], i, "role", v)} /></Field>
                  <Field label="Ubicación"><Input value={t.location ?? ""} onChange={v => setArr(["sections", "testimonials"], i, "location", v)} /></Field>
                  <Field label="Iniciales avatar"><Input value={t.avatarInitials ?? ""} onChange={v => setArr(["sections", "testimonials"], i, "avatarInitials", v)} placeholder="MG" /></Field>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <Field label="Color avatar 1">
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input type="color" value={t.avatarColor1 ?? "#FF8A5B"} onChange={e => setArr(["sections", "testimonials"], i, "avatarColor1", e.target.value)} style={{ width: 36, height: 30, borderRadius: 4, border: "1px solid hsl(var(--border))", cursor: "pointer" }} />
                      <span style={{ fontSize: 12 }}>{t.avatarColor1 ?? "#FF8A5B"}</span>
                    </div>
                  </Field>
                  <Field label="Color avatar 2">
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input type="color" value={t.avatarColor2 ?? "#FF4D8D"} onChange={e => setArr(["sections", "testimonials"], i, "avatarColor2", e.target.value)} style={{ width: 36, height: 30, borderRadius: 4, border: "1px solid hsl(var(--border))", cursor: "pointer" }} />
                      <span style={{ fontSize: 12 }}>{t.avatarColor2 ?? "#FF4D8D"}</span>
                    </div>
                  </Field>
                </div>
              </div>
            ))}
            <Btn variant="ghost" onClick={() => addToArr(["sections", "testimonials"], { quote: "", name: "", role: "", location: "", avatarInitials: "", avatarColor1: "#4F46E5", avatarColor2: "#7C3AED" })}><Plus size={14} /> Agregar testimonio</Btn>
          </Accordion>

          {/* Pricing */}
          <Accordion title="Planes de precios">
            {(sections.pricing ?? []).map((p, i) => (
              <div key={i} style={{ padding: 12, background: "hsl(var(--background))", borderRadius: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name || `Plan ${i + 1}`}</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Toggle checked={p.highlight ?? false} onChange={v => setArr(["sections", "pricing"], i, "highlight", v)} label="Destacado" />
                    <button onClick={() => removeFromArr(["sections", "pricing"], i)} style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(0 72% 51%)" }}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <Field label="Nombre"><Input value={p.name ?? ""} onChange={v => setArr(["sections", "pricing"], i, "name", v)} placeholder="Starter" /></Field>
                  <Field label="Precio"><Input value={p.price ?? ""} onChange={v => setArr(["sections", "pricing"], i, "price", v)} placeholder="$49/mes" /></Field>
                  <Field label="CTA"><Input value={p.cta ?? ""} onChange={v => setArr(["sections", "pricing"], i, "cta", v)} placeholder="Empezar" /></Field>
                </div>
                <Field label="Descripción"><Input textarea value={p.description ?? ""} onChange={v => setArr(["sections", "pricing"], i, "description", v)} /></Field>
                <SectionTitle>Características</SectionTitle>
                {(p.features ?? []).map((f, fi) => (
                  <div key={fi} style={{ display: "flex", gap: 6 }}>
                    <Input value={f} onChange={v => {
                      const next = [...(p.features ?? [])];
                      next[fi] = v;
                      setArr(["sections", "pricing"], i, "features", next);
                    }} placeholder="Característica" />
                    <button onClick={() => {
                      const next = (p.features ?? []).filter((_, idx) => idx !== fi);
                      setArr(["sections", "pricing"], i, "features", next);
                    }} style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(0 72% 51%)" }}><Trash2 size={14} /></button>
                  </div>
                ))}
                <Btn variant="ghost" onClick={() => setArr(["sections", "pricing"], i, "features", [...(p.features ?? []), ""])}><Plus size={14} /> Agregar característica</Btn>
              </div>
            ))}
            <Btn variant="ghost" onClick={() => addToArr(["sections", "pricing"], { name: "", price: "", description: "", cta: "", highlight: false, features: [] })}><Plus size={14} /> Agregar plan</Btn>
          </Accordion>

          {/* FAQ */}
          <Accordion title="FAQ">
            {(sections.faq ?? []).map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <Input value={f.question ?? ""} onChange={v => setArr(["sections", "faq"], i, "question", v)} placeholder="¿Pregunta?" />
                  <Input textarea value={f.answer ?? ""} onChange={v => setArr(["sections", "faq"], i, "answer", v)} placeholder="Respuesta…" />
                </div>
                <button onClick={() => removeFromArr(["sections", "faq"], i)} style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(0 72% 51%)", marginTop: 4 }}><Trash2 size={14} /></button>
              </div>
            ))}
            <Btn variant="ghost" onClick={() => addToArr(["sections", "faq"], { question: "", answer: "" })}><Plus size={14} /> Agregar pregunta</Btn>
          </Accordion>
        </div>
      )}

      {/* ── TAB: Imágenes ── */}
      {tab === "images" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <SectionTitle>Media global</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <ImageUploadField
                label="Imagen del Hero"
                currentUrl={media.heroImageUrl}
                onUploaded={(url) => set(["media", "heroImageUrl"], url)}
              />
              <ImageUploadField
                label="Logo"
                currentUrl={media.logoUrl}
                onUploaded={(url) => set(["media", "logoUrl"], url)}
              />
            </div>
          </Card>
          <Card>
            <SectionTitle>Fotos de testimonios</SectionTitle>
            {(sections.testimonials ?? []).length === 0 && (
              <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>Agrega testimonios en la pestaña Contenido primero.</p>
            )}
            {(sections.testimonials ?? []).map((t, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <ImageUploadField
                  label={`Foto de ${t.name || `Testimonio ${i + 1}`}`}
                  currentUrl={t.avatarImageUrl}
                  onUploaded={(url) => setArr(["sections", "testimonials"], i, "avatarImageUrl", url)}
                />
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* ── TAB: Vista previa ── */}
      {tab === "preview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", margin: 0 }}>
              La vista previa muestra el landing con la configuración guardada. Guarda los cambios primero.
            </p>
            <Btn variant="ghost" onClick={() => window.open("/landing/index.html?preview=1", "_blank")}>
              <Eye size={14} /> Abrir en nueva pestaña
            </Btn>
          </div>
          <iframe
            src="/landing/index.html?preview=1"
            style={{ width: "100%", height: "80vh", border: "1px solid hsl(var(--border))", borderRadius: 10 }}
            title="Landing preview"
          />
        </div>
      )}
    </div>
  );
}
