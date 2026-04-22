import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { api, setAuthState } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

/** Minimal field component — matches login page for visual parity. */
function Field({
  id,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  required,
  disabled,
  helper,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  disabled?: boolean;
  helper?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label
        htmlFor={id}
        style={{ fontSize: "12px", fontWeight: 500, color: "hsl(var(--fg-2))" }}
      >
        {label}
      </label>
      <input
        id={id}
        data-testid={`input-${id}`}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        style={{
          height: "32px",
          padding: "0 10px",
          background: "hsl(var(--bg))",
          border: "1px solid hsl(var(--border))",
          borderRadius: "4px",
          color: "hsl(var(--fg))",
          fontSize: "13px",
          outline: "none",
          opacity: disabled ? 0.6 : 1,
        }}
      />
      {helper && (
        <span style={{ fontSize: "11px", color: "hsl(var(--fg-3))" }}>{helper}</span>
      )}
    </div>
  );
}

function parseError(err: unknown): string {
  if (!(err instanceof Error)) return "Error desconocido";
  const m = err.message;
  const idx = m.indexOf(": ");
  if (idx < 0) return m;
  const rest = m.slice(idx + 2);
  try {
    const p = JSON.parse(rest) as { message?: string | string[] };
    if (Array.isArray(p.message)) return p.message.join(", ");
    if (typeof p.message === "string") return p.message;
  } catch {
    /* ignore */
  }
  return rest || m;
}

interface InvitationInfo {
  email: string;
  role: string;
  workspace: { name: string; slug: string };
  expires_at: string;
}

export default function AcceptInvitePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const token = useMemo(() => {
    const q = window.location.hash.split("?")[1] ?? "";
    const params = new URLSearchParams(q);
    return params.get("token") ?? "";
  }, []);

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrorMsg("No se encontró el token de invitación.");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const data = await api.verifyInvitationToken(token);
        setInvitation(data);
      } catch (err) {
        setErrorMsg(parseError(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirm) {
      toast({
        title: "Las contraseñas no coinciden",
        description: "Revisa que ambos campos sean idénticos.",
        variant: "destructive",
      });
      return;
    }
    if (password.length < 8) {
      toast({
        title: "Contraseña muy corta",
        description: "Mínimo 8 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.acceptInvitation({
        token,
        password,
        name: name.trim() || undefined,
      });

      // Persist session so user lands logged in
      setAuthState(
        res.access_token,
        res.user.workspace.slug,
        res.refresh_token,
      );
      try {
        localStorage.setItem("pymes_user", JSON.stringify(res.user));
      } catch {
        /* ignore */
      }

      toast({
        title: "¡Bienvenido!",
        description: `Tu cuenta en ${res.user.workspace.name} está lista.`,
      });

      // Hard reload so all auth state hydrates cleanly
      window.location.hash = "#/";
      window.location.reload();
    } catch (err) {
      toast({
        title: "No se pudo aceptar la invitación",
        description: parseError(err),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const shellStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "hsl(var(--bg))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
  };

  const cardStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "400px",
    background: "hsl(var(--bg-card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "4px",
    padding: "32px",
  };

  if (loading) {
    return (
      <div style={shellStyle}>
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              color: "hsl(var(--fg-2))",
              fontSize: "13px",
            }}
          >
            <Loader2 size={16} className="animate-spin" />
            Validando tu invitación…
          </div>
        </div>
      </div>
    );
  }

  if (errorMsg || !invitation) {
    return (
      <div style={shellStyle}>
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "12px",
            }}
          >
            <AlertCircle size={16} style={{ color: "#e87f7f" }} />
            <h1
              style={{
                margin: 0,
                fontSize: "15px",
                fontWeight: 600,
                color: "hsl(var(--fg))",
              }}
            >
              Invitación inválida
            </h1>
          </div>
          <p
            style={{
              margin: "0 0 20px",
              fontSize: "13px",
              color: "hsl(var(--fg-2))",
              lineHeight: 1.6,
            }}
          >
            {errorMsg ??
              "El enlace de invitación no es válido. Pide a tu administrador que envíe uno nuevo."}
          </p>
          <button
            onClick={() => setLocation("/login")}
            style={{
              height: "32px",
              padding: "0 14px",
              background: "hsl(var(--accent))",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Ir al login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "4px",
          }}
        >
          <CheckCircle2 size={16} style={{ color: "hsl(var(--accent))" }} />
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "hsl(var(--fg-3))",
            }}
          >
            Invitación
          </span>
        </div>

        <h1
          style={{
            margin: "0 0 6px",
            fontSize: "18px",
            fontWeight: 600,
            color: "hsl(var(--fg))",
          }}
        >
          Únete a {invitation.workspace.name}
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: "13px",
            color: "hsl(var(--fg-2))",
            lineHeight: 1.5,
          }}
        >
          Crea tu cuenta como <strong style={{ color: "hsl(var(--fg))" }}>{invitation.role}</strong> para{" "}
          {invitation.email}.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "14px" }}
        >
          <Field
            id="invite-email"
            label="Correo"
            value={invitation.email}
            onChange={() => {}}
            disabled
          />
          <Field
            id="invite-name"
            label="Nombre"
            placeholder="Tu nombre completo"
            value={name}
            onChange={setName}
          />
          <Field
            id="invite-password"
            label="Contraseña"
            type="password"
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={setPassword}
            required
            helper="Usa una contraseña fuerte que no reutilices en otros sitios."
          />
          <Field
            id="invite-password-confirm"
            label="Confirmar contraseña"
            type="password"
            placeholder="Repite la contraseña"
            value={confirm}
            onChange={setConfirm}
            required
          />

          <button
            type="submit"
            disabled={submitting}
            data-testid="button-accept-invite"
            style={{
              marginTop: "6px",
              height: "34px",
              background: "hsl(var(--accent))",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? "Aceptando…" : "Aceptar y crear cuenta"}
          </button>
        </form>
      </div>
    </div>
  );
}
