import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Users, Building2, MessageSquare, FileText, TrendingUp, BarChart3 } from "lucide-react";

// ── Category labels ────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  alimentacion_bebidas:      "Alimentación y bebidas",
  servicios_profesionales:   "Servicios profesionales",
  comercio_ventas:           "Comercio y ventas",
  salud_bienestar:           "Salud y bienestar",
  educacion_formacion:       "Educación y formación",
  tecnologia_software:       "Tecnología y software",
  construccion_remodelacion: "Construcción y remodelación",
  transporte_logistica:      "Transporte y logística",
  turismo_hospitalidad:      "Turismo y hospitalidad",
  belleza_estetica:          "Belleza y estética",
  entretenimiento_eventos:   "Entretenimiento y eventos",
  agropecuario:              "Agropecuario",
  servicios_hogar:           "Servicios del hogar",
  manufactura_artesania:     "Manufactura y artesanía",
  bienes_raices:             "Bienes raíces",
  otro:                      "Otro",
};

const TEAM_LABELS: Record<string, string> = {
  solo:    "Solo yo",
  "2_5":   "2–5 personas",
  "6_20":  "6–20 personas",
  "20_plus": "Más de 20",
};

const PLAN_COLORS: Record<string, string> = {
  FREE:         "hsl(220 13% 60%)",
  STARTER:      "hsl(210 90% 55%)",
  GROWTH:       "hsl(142 70% 45%)",
  BUSINESS:     "hsl(260 70% 55%)",
  BUSINESS_PLUS:"hsl(32 90% 50%)",
  ENTERPRISE:   "hsl(0 70% 50%)",
};

// ── Shared card ────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "hsl(var(--bg))",
      border: "1px solid hsl(var(--border))",
      borderRadius: "8px",
      padding: "20px",
      ...style,
    }}>
      {children}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }: {
  icon: any; label: string; value: string | number; sub?: string;
}) {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <div style={{
          width: "36px", height: "36px",
          background: "hsl(var(--accent) / 0.12)",
          borderRadius: "8px",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Icon style={{ width: 16, height: 16, color: "hsl(var(--accent))" }} />
        </div>
        <div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "hsl(var(--fg))", lineHeight: 1.2 }}>{value}</div>
          <div style={{ fontSize: "12px", color: "hsl(var(--fg-2))", marginTop: "2px" }}>{label}</div>
          {sub && <div style={{ fontSize: "11px", color: "hsl(var(--fg-2))", marginTop: "2px", opacity: 0.7 }}>{sub}</div>}
        </div>
      </div>
    </Card>
  );
}

// ── Bar chart (CSS-based, no lib required) ─────────────────────────────────

function HBarChart({ data, maxVal }: { data: { label: string; count: number }[]; maxVal: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {data.map(d => (
        <div key={d.label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "180px", fontSize: "12px", color: "hsl(var(--fg-2))", flexShrink: 0, textAlign: "right" }}>
            {d.label}
          </div>
          <div style={{ flex: 1, height: "20px", background: "hsl(var(--border))", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: maxVal > 0 ? `${(d.count / maxVal) * 100}%` : "0%",
              background: "hsl(var(--accent))",
              borderRadius: "4px",
              transition: "width 0.5s ease",
              minWidth: d.count > 0 ? "4px" : "0",
            }} />
          </div>
          <div style={{ width: "28px", fontSize: "12px", fontWeight: 600, color: "hsl(var(--fg))", flexShrink: 0 }}>
            {d.count}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Registrations timeline ─────────────────────────────────────────────────

function RegistrationsChart({ data }: { data: { month: string; count: number }[] }) {
  if (!data.length) return <p style={{ fontSize: "13px", color: "hsl(var(--fg-2))" }}>Sin datos aún.</p>;
  const max = Math.max(...data.map(d => d.count), 1);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "100px" }}>
      {data.map(d => (
        <div key={d.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
          <div style={{ fontSize: "10px", color: "hsl(var(--fg-2))", fontWeight: 600 }}>{d.count}</div>
          <div style={{
            width: "100%",
            height: `${(d.count / max) * 72}px`,
            background: "hsl(var(--accent))",
            borderRadius: "3px 3px 0 0",
            minHeight: d.count > 0 ? "4px" : "0",
            transition: "height 0.4s ease",
          }} />
          <div style={{ fontSize: "10px", color: "hsl(var(--fg-2))", transform: "rotate(-45deg)", whiteSpace: "nowrap" }}>
            {d.month.slice(5)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsSearch, setWsSearch] = useState("");

  // Guard: only platform admins
  useEffect(() => {
    if (user && !user.is_platform_admin) {
      window.location.hash = "#/";
    }
  }, [user]);

  useEffect(() => {
    if (!user?.is_platform_admin) return;
    Promise.all([api.platformGetStats(), api.platformListWorkspaces()])
      .then(([s, w]) => { setStats(s); setWorkspaces(w); })
      .finally(() => setLoading(false));
  }, [user]);

  if (!user?.is_platform_admin) return null;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <Loader2 style={{ width: 24, height: 24, animation: "spin 1s linear infinite", color: "hsl(var(--accent))" }} />
      </div>
    );
  }

  const filteredWs = workspaces.filter(w =>
    w.name.toLowerCase().includes(wsSearch.toLowerCase()) ||
    w.slug.toLowerCase().includes(wsSearch.toLowerCase()),
  );

  const catDistMax = stats?.categoriesDistribution?.[0]?.count ?? 1;

  return (
    <div style={{
      minHeight: "100vh",
      background: "hsl(var(--bg-2, var(--bg)))",
      padding: "32px 24px",
      maxWidth: "1100px",
      margin: "0 auto",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "hsl(var(--fg))", letterSpacing: "-0.01em" }}>
            Panel PymesHub
          </h1>
          <p style={{ fontSize: "13px", color: "hsl(var(--fg-2))", marginTop: "2px" }}>
            Métricas de plataforma — solo administradores
          </p>
        </div>
        <a href="#/" style={{ fontSize: "13px", color: "hsl(var(--accent))", textDecoration: "none" }}>
          ← Volver al workspace
        </a>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px", marginBottom: "28px" }}>
        <StatCard icon={Building2} label="Workspaces activos" value={stats?.totalWorkspaces ?? 0} />
        <StatCard icon={Users}     label="Usuarios activos" value={stats?.totalUsers ?? 0} sub={`${stats?.activeUsers ?? 0} en últimos 30 días`} />
        <StatCard icon={MessageSquare} label="Conversaciones" value={stats?.totalConversations ?? 0} />
        <StatCard icon={FileText}  label="Facturas" value={stats?.totalInvoices ?? 0} />
        <StatCard icon={BarChart3} label="Con perfil de negocio" value={stats?.profiledWorkspaces ?? 0}
          sub={stats?.totalWorkspaces ? `${Math.round((stats.profiledWorkspaces / stats.totalWorkspaces) * 100)}% completado` : ""} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>

        {/* Section 1 — Category distribution */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <BarChart3 style={{ width: 15, height: 15, color: "hsl(var(--accent))" }} />
            <h2 style={{ fontSize: "14px", fontWeight: 600, color: "hsl(var(--fg))" }}>
              Distribución por sector
            </h2>
          </div>
          {stats?.categoriesDistribution?.length ? (
            <HBarChart
              data={(stats.categoriesDistribution as { category: string; count: number }[]).map(d => ({
                label: CATEGORY_LABELS[d.category] ?? d.category,
                count: d.count,
              }))}
              maxVal={catDistMax}
            />
          ) : (
            <p style={{ fontSize: "13px", color: "hsl(var(--fg-2))" }}>Sin datos aún.</p>
          )}
        </Card>

        {/* Section 2 — Registration trend */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <TrendingUp style={{ width: 15, height: 15, color: "hsl(var(--accent))" }} />
            <h2 style={{ fontSize: "14px", fontWeight: 600, color: "hsl(var(--fg))" }}>
              Registros últimos 12 meses
            </h2>
          </div>
          <RegistrationsChart data={stats?.registrationsByMonth ?? []} />
        </Card>
      </div>

      {/* Section 4 — Usage by segment */}
      {stats?.usageByCategory?.length > 0 && (
        <Card style={{ marginBottom: "20px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "hsl(var(--fg))", marginBottom: "16px" }}>
            Métricas promedio por segmento
          </h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                  {["Sector", "Contactos prom.", "Conversaciones prom.", "Facturas prom."].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "hsl(var(--fg-2))", fontWeight: 500, whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(stats.usageByCategory as any[]).map((row, i) => (
                  <tr key={row.category} style={{ borderBottom: "1px solid hsl(var(--border))", background: i % 2 === 0 ? "transparent" : "hsl(var(--border) / 0.3)" }}>
                    <td style={{ padding: "8px 12px", color: "hsl(var(--fg))", fontWeight: 500 }}>
                      {CATEGORY_LABELS[row.category] ?? row.category}
                    </td>
                    <td style={{ padding: "8px 12px", color: "hsl(var(--fg))" }}>{row.avg_contacts}</td>
                    <td style={{ padding: "8px 12px", color: "hsl(var(--fg))" }}>{row.avg_conversations}</td>
                    <td style={{ padding: "8px 12px", color: "hsl(var(--fg))" }}>{row.avg_invoices}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Section 3 — Workspace table */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "hsl(var(--fg))" }}>
            Todos los workspaces
          </h2>
          <input
            type="search"
            placeholder="Buscar por nombre o slug…"
            value={wsSearch}
            onChange={e => setWsSearch(e.target.value)}
            style={{
              height: "28px", padding: "0 10px",
              background: "hsl(var(--bg))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "4px",
              fontSize: "12px", color: "hsl(var(--fg))",
              outline: "none", width: "220px",
            }}
          />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                {["Workspace", "Sector", "Plan", "Usuarios", "Registrado", "Estado"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "hsl(var(--fg-2))", fontWeight: 500, whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredWs.map((w, i) => (
                <tr key={w.id} style={{ borderBottom: "1px solid hsl(var(--border))", background: i % 2 === 0 ? "transparent" : "hsl(var(--border) / 0.3)" }}>
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ fontWeight: 500, color: "hsl(var(--fg))" }}>{w.name}</div>
                    <div style={{ fontSize: "11px", color: "hsl(var(--fg-2))" }}>{w.slug}</div>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    {w.business_profile?.categories?.length ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {(w.business_profile.categories as string[]).slice(0, 2).map((c: string) => (
                          <span key={c} style={{
                            fontSize: "10px", padding: "2px 6px",
                            background: "hsl(var(--accent) / 0.1)",
                            color: "hsl(var(--accent))",
                            borderRadius: "3px", fontWeight: 500,
                          }}>
                            {CATEGORY_LABELS[c] ?? c}
                          </span>
                        ))}
                        {w.business_profile.categories.length > 2 && (
                          <span style={{ fontSize: "10px", color: "hsl(var(--fg-2))" }}>
                            +{w.business_profile.categories.length - 2}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: "11px", color: "hsl(var(--fg-2))" }}>Sin perfil</span>
                    )}
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{
                      fontSize: "11px", padding: "2px 7px",
                      background: `${PLAN_COLORS[w.plan] ?? "hsl(var(--border))"}22`,
                      color: PLAN_COLORS[w.plan] ?? "hsl(var(--fg-2))",
                      borderRadius: "3px", fontWeight: 600,
                    }}>
                      {w.plan}
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px", color: "hsl(var(--fg))" }}>{w.member_count}</td>
                  <td style={{ padding: "8px 12px", color: "hsl(var(--fg-2))", whiteSpace: "nowrap" }}>
                    {new Date(w.created_at).toLocaleDateString("es-CR")}
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{
                      fontSize: "11px", padding: "2px 7px",
                      background: w.status === "ACTIVE" ? "hsl(142 70% 45% / 0.15)" : "hsl(0 70% 50% / 0.15)",
                      color: w.status === "ACTIVE" ? "hsl(142 70% 38%)" : "hsl(0 70% 50%)",
                      borderRadius: "3px", fontWeight: 600,
                    }}>
                      {w.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredWs.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "hsl(var(--fg-2))", fontSize: "13px" }}>
                    No se encontraron workspaces.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
