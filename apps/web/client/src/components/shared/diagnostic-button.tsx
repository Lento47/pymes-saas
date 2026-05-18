import { useState, useMemo } from "react";
import { AlertTriangle, CheckCircle2, LifeBuoy, Loader2, Search, ShieldCheck, Wrench, XCircle, X, ArrowRight, MessageCircle, Mail, Settings } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

type KnownIssue = { title: string; workaround?: string };
type DiagnosticResult = { case_id: string; category: string; risk_level: string; recommendation?: string; matched_known_issue?: KnownIssue };

interface DiagnosticButtonProps {
  module: string;
  className?: string;
}

const MODULE_LABELS: Record<string, string> = {
  inbox: "Bandeja de entrada",
  conversations: "Conversaciones",
  dashboard: "Panel principal",
  invoices: "Facturación",
  contacts: "Contactos",
  billing: "Facturación y plan",
  automations: "Automatizaciones",
  documents: "Documentos",
};

const MODULE_GUIDANCE: Record<string, { icon: React.ReactNode; tips: string[] }> = {
  inbox: {
    icon: <MessageCircle className="h-3.5 w-3.5" />,
    tips: [
      "Verificá que tengas al menos un canal activo (WhatsApp, Email o Telegram) en Configuración → Canales",
      "Si los mensajes no llegan, revisá que el webhook esté configurado correctamente en el proveedor",
      "Los mensajes nuevos aparecen automáticamente en la bandeja — no es necesario recargar",
    ],
  },
  conversations: {
    icon: <MessageCircle className="h-3.5 w-3.5" />,
    tips: [
      "Revisá que los canales estén ACTIVOS en Configuración → Canales",
      "Verificá la conexión del webhook en el panel del proveedor",
    ],
  },
  channels: {
    icon: <Settings className="h-3.5 w-3.5" />,
    tips: [
      "Asegurate que los tokens y secretos estén correctamente configurados",
      "Verificá que el webhook URL sea accesible desde Internet",
    ],
  },
};

const CATEGORY_BADGE: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
  USER_GUIDANCE: { bg: "bg-blue-500/10", text: "text-blue-300", icon: <LifeBuoy className="h-3 w-3" />, label: "Guía de uso" },
  PERMISSION_ISSUE: { bg: "bg-amber-500/10", text: "text-amber-300", icon: <ShieldCheck className="h-3 w-3" />, label: "Permisos" },
  WORKSPACE_CONFIGURATION: { bg: "bg-violet-500/10", text: "text-violet-300", icon: <Wrench className="h-3 w-3" />, label: "Configuración" },
  INTEGRATION_ISSUE: { bg: "bg-orange-500/10", text: "text-orange-300", icon: <AlertTriangle className="h-3 w-3" />, label: "Integración" },
  PRODUCT_BUG: { bg: "bg-red-500/10", text: "text-red-300", icon: <XCircle className="h-3 w-3" />, label: "Bug" },
  BILLING_OR_PLAN: { bg: "bg-yellow-500/10", text: "text-yellow-300", icon: <AlertTriangle className="h-3 w-3" />, label: "Plan/Facturación" },
  PLATFORM_INCIDENT: { bg: "bg-red-700/10", text: "text-red-500", icon: <AlertTriangle className="h-3 w-3" />, label: "Incidente" },
};

const RISK_COLOR: Record<string, string> = {
  low: "text-emerald-400",
  medium: "text-amber-400",
  high: "text-orange-400",
  critical: "text-red-500",
};

export function DiagnosticButton({ module, className }: DiagnosticButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const moduleGuide = MODULE_GUIDANCE[module] || MODULE_GUIDANCE.conversations;
  const moduleLabel = MODULE_LABELS[module] || module;

  const handleDiagnose = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.runDiagnostic(module);
      setResult(res as DiagnosticResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo completar el diagnóstico");
    } finally {
      setLoading(false);
    }
  };

  const categoryInfo = result ? CATEGORY_BADGE[result.category] || CATEGORY_BADGE.USER_GUIDANCE : null;
  const isSkipped = result?.case_id === "skipped" || result?.case_id === "no";
  const isRealCase = result?.case_id && !isSkipped;
  const isAiAnalyzed = result?.case_id === "ai_analyzed";
  const isGuidanceOnly = (isSkipped || isAiAnalyzed) && result?.category === "USER_GUIDANCE" && !result?.matched_known_issue;

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={handleDiagnose}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all duration-200 hover:scale-[1.02] disabled:opacity-50"
        style={{
          background: "hsl(var(--foreground) / 0.04)",
          border: "1px solid hsl(var(--foreground) / 0.06)",
          color: "hsl(var(--fg-2))",
        }}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Search className="h-3 w-3" />
        )}
        Diagnosticar
      </button>

      {result && (
        <div
          className="mt-3 rounded-md border p-4 text-left animate-in fade-in slide-in-from-top-2 duration-200"
          style={{
            background: "hsl(var(--bg-card) / 0.9)",
            borderColor: isRealCase ? "hsl(var(--border))" : "hsl(var(--primary) / 0.15)",
          }}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              {categoryInfo && (
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", categoryInfo.bg, categoryInfo.text)}>
                  {categoryInfo.icon}
                  {categoryInfo.label}
                </span>
              )}
              <span className={cn("text-[10px] font-semibold uppercase tracking-wide", RISK_COLOR[result.risk_level] || "text-muted-foreground")}>
                {result.risk_level}
              </span>
            </div>
            <button
              onClick={() => setResult(null)}
              className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {result.matched_known_issue && (
            <div
              className="mb-3 rounded-md px-3 py-2 text-[11px]"
              style={{ background: "hsl(var(--warning) / 0.08)", border: "1px solid hsl(var(--warning) / 0.15)" }}
            >
              <p className="font-medium text-amber-300">Problema conocido: {result.matched_known_issue.title}</p>
              {result.matched_known_issue.workaround && (
                <p className="mt-1 text-muted-foreground/80">Solución temporal: {result.matched_known_issue.workaround}</p>
              )}
            </div>
          )}

          {isGuidanceOnly ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground/80 leading-relaxed">
                No se detectaron problemas específicos en <strong>{moduleLabel}</strong>.
                {result.recommendation && !result.recommendation.includes('configuration or usage question') && (
                  <span className="block mt-1">{result.recommendation}</span>
                )}
              </p>
              <div
                className="rounded-md px-3 py-2 text-[11px] space-y-1.5"
                style={{ background: "hsl(var(--primary) / 0.05)", border: "1px solid hsl(var(--primary) / 0.1)" }}
              >
                <p className="flex items-center gap-1.5 font-medium" style={{ color: "hsl(var(--fg))" }}>
                  {moduleGuide.icon}
                  Tips para {moduleLabel}
                </p>
                {moduleGuide.tips.map((tip, i) => (
                  <p key={i} className="pl-5 text-muted-foreground/80">• {tip}</p>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/90 leading-relaxed">{result.recommendation}</p>
          )}

          <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between">
            {isRealCase ? (
              <>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  <span className="text-[10px] text-muted-foreground">
                    Caso <span className="font-mono text-foreground/70">{result.case_id.slice(0, 8)}</span> registrado
                  </span>
                </div>
                <Link href="/support">
                  <span className="inline-flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 cursor-pointer">
                    Ver en soporte <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <LifeBuoy className="h-3 w-3 text-blue-400" />
                <span className="text-[10px] text-muted-foreground">
                  {isAiAnalyzed ? "Analizado con IA" : isGuidanceOnly ? "Sin incidencias — solo tips informativos" : "Sugerencia — no se creó caso"}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 text-[11px] text-red-400">{error}</div>
      )}
    </div>
  );
}
