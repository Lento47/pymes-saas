import { useState } from "react";
import { api } from "@/lib/api";
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

export default function RegisterPage() {
  const { toast } = useToast();
  const { refreshUser } = useAuth();
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [pass, setPass]       = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pass !== confirm) {
      toast({ title: "Las contraseñas no coinciden", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await api.register({ email, name, password: pass });
      // store tokens exactly like the login flow
      localStorage.setItem("access_token", res.access_token);
      localStorage.setItem("refresh_token", res.refresh_token);
      localStorage.setItem("workspace_slug", res.workspace.slug);
      await refreshUser();
      window.location.hash = "#/onboarding";
    } catch (err) {
      toast({ title: "Error al crear cuenta", description: parseError(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "hsl(var(--bg))",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{ width: "100%", maxWidth: "360px" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "32px" }}>
          <div style={{
            width: "28px", height: "28px",
            background: "hsl(var(--accent))",
            borderRadius: "4px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "#fff", fontSize: "11px", fontWeight: 700, lineHeight: 1 }}>P</span>
          </div>
          <span style={{ fontSize: "15px", fontWeight: 600, color: "hsl(var(--fg))" }}>Pymeshub</span>
        </div>

        <h1 style={{ fontSize: "20px", fontWeight: 600, color: "hsl(var(--fg))", letterSpacing: "-0.01em", marginBottom: "4px" }}>
          Crear cuenta
        </h1>
        <p style={{ fontSize: "13px", color: "hsl(var(--fg-2))", marginBottom: "24px" }}>
          Registra tu negocio gratis — sin tarjeta de crédito
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <Field id="name" label="Nombre completo" placeholder="María García" value={name} onChange={setName} required />
          <Field id="email" label="Correo electrónico" type="email" placeholder="nombre@empresa.com" value={email} onChange={setEmail} required />
          <Field id="password" label="Contraseña" type="password" placeholder="Mín. 12 caracteres" value={pass} onChange={setPass} required />
          <Field id="confirm" label="Confirmar contraseña" type="password" placeholder="••••••••••••" value={confirm} onChange={setConfirm} required />

          <button
            type="submit"
            disabled={loading}
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
            }}
          >
            {loading && <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} />}
            Crear cuenta
          </button>
        </form>

        <p style={{ marginTop: "20px", fontSize: "12px", color: "hsl(var(--fg-2))", textAlign: "center" }}>
          ¿Ya tienes cuenta?{" "}
          <a href="#/login" style={{ color: "hsl(var(--accent))", textDecoration: "none" }}>
            Iniciar sesión
          </a>
        </p>
      </div>
    </div>
  );
}
