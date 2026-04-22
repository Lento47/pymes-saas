import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

function parseError(err: unknown): string {
  if (!(err instanceof Error)) return "Error desconocido";
  const m = err.message;
  const after = m.indexOf(": ");
  if (after < 0) return m;
  const rest = m.slice(after + 2);
  try {
    const p = JSON.parse(rest) as { message?: string | string[] };
    if (Array.isArray(p.message)) return p.message.join(", ");
    if (typeof p.message === "string") return p.message;
  } catch { /* ignore */ }
  return rest || m;
}

// Minimal field component — styled inline for pixel-perfect CF fidelity
function Field({ id, label, type = "text", placeholder, value, onChange, required }: {
  id: string; label: string; type?: string;
  placeholder?: string; value: string;
  onChange: (v: string) => void; required?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label htmlFor={id} style={{ fontSize: "12px", fontWeight: 500, color: "hsl(var(--fg-2))" }}>
        {label}
      </label>
      <input
        id={id}
        data-testid={`input-${id}`}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        style={{
          height: "32px",
          padding: "0 10px",
          background: "hsl(var(--bg))",
          border: "1px solid hsl(var(--border))",
          borderRadius: "4px",
          color: "hsl(var(--fg))",
          fontSize: "13px",
          outline: "none",
          transition: "border-color 0.1s",
        }}
        onFocus={e => (e.target.style.borderColor = "hsl(var(--accent))")}
        onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")}
      />
    </div>
  );
}

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [slug, setSlug]     = useState("");
  const [email, setEmail]   = useState("");
  const [pass, setPass]     = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) window.location.hash = "#/";
  }, [isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, pass, slug);
      window.location.hash = "#/";
    } catch (err) {
      toast({ title: "Error al iniciar sesión", description: parseError(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "hsl(var(--bg))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "360px" }}>
        {/* Logo mark */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "32px" }}>
          <div style={{
            width: "28px", height: "28px",
            background: "hsl(var(--accent))",
            borderRadius: "4px",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <span style={{ color: "#fff", fontSize: "11px", fontWeight: 700, lineHeight: 1 }}>P</span>
          </div>
          <span style={{ fontSize: "15px", fontWeight: 600, color: "hsl(var(--fg))" }}>Pymeshub</span>
        </div>

        {/* Heading */}
        <h1 style={{ fontSize: "20px", fontWeight: 600, color: "hsl(var(--fg))", letterSpacing: "-0.01em", marginBottom: "4px" }}>
          Iniciar sesión
        </h1>
        <p style={{ fontSize: "13px", color: "hsl(var(--fg-2))", marginBottom: "24px" }}>
          Ingresa a tu workspace
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <Field id="workspace-slug" label="Workspace" placeholder="mi-empresa" value={slug} onChange={setSlug} required />
          <Field id="email" label="Correo" type="email" placeholder="nombre@empresa.com" value={email} onChange={setEmail} required />
          <Field id="password" label="Contraseña" type="password" placeholder="••••••••" value={pass} onChange={setPass} required />

          <button
            type="submit"
            disabled={loading}
            data-testid="button-login"
            style={{
              marginTop: "6px",
              height: "32px",
              background: loading ? "hsl(var(--accent) / 0.7)" : "hsl(var(--accent))",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              transition: "opacity 0.1s",
            }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.opacity = "0.9"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
          >
            {loading && <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} />}
            Entrar
          </button>
        </form>

        <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
            <Link href="/legal/terms-and-conditions">
              <span style={{ fontSize: "12px", color: "hsl(var(--fg-2))", cursor: "pointer" }}>Términos</span>
            </Link>
            <Link href="/legal/privacy-policy">
              <span style={{ fontSize: "12px", color: "hsl(var(--fg-2))", cursor: "pointer" }}>Privacidad</span>
            </Link>
            <Link href="/legal">
              <span style={{ fontSize: "12px", color: "hsl(var(--fg-2))", cursor: "pointer" }}>Centro legal</span>
            </Link>
          </div>

          <p style={{ fontSize: "12px", color: "hsl(var(--fg-3))", textAlign: "center" }}>
            © {new Date().getFullYear()} Pymeshub
          </p>
        </div>
      </div>
    </div>
  );
}
