import { cn } from "@/lib/utils";

// Cloudflare-style status pill: small, muted, text-only label.
// No vivid backgrounds — rely on text color + subtle bg tint.

const STYLES: Record<string, { bg: string; color: string; label?: string }> = {
  // Conversation
  NEW:             { bg: "hsl(214 89% 52% / 0.12)", color: "hsl(214 89% 62%)",  label: "Nuevo" },
  OPEN:            { bg: "hsl(145 63% 42% / 0.12)", color: "hsl(145 63% 52%)",  label: "Abierto" },
  PENDING:         { bg: "hsl(38 95% 54% / 0.12)",  color: "hsl(38 95% 60%)",   label: "Pendiente" },
  RESOLVED:        { bg: "hsl(0 0% 42% / 0.12)",    color: "hsl(0 0% 60%)",     label: "Resuelto" },
  ARCHIVED:        { bg: "hsl(0 0% 42% / 0.10)",    color: "hsl(0 0% 50%)",     label: "Archivado" },
  IA_ATTENDING:    { bg: "hsl(214 89% 52% / 0.12)", color: "hsl(214 89% 62%)",  label: "IA Activa" },
  REQUIRES_HUMAN:  { bg: "hsl(38 95% 54% / 0.14)",  color: "hsl(38 95% 55%)",   label: "Req. Humano" },
  WAITING_CLIENT:  { bg: "hsl(0 0% 42% / 0.12)",    color: "hsl(0 0% 60%)",     label: "Esp. Cliente" },
  IN_PROGRESS:     { bg: "hsl(214 89% 52% / 0.12)", color: "hsl(214 89% 62%)",  label: "En progreso" },
  BLOCKED:         { bg: "hsl(0 72% 51% / 0.12)",   color: "hsl(0 72% 62%)",    label: "Bloqueado" },
  SPAM:            { bg: "hsl(0 0% 42% / 0.10)",    color: "hsl(0 0% 50%)",     label: "Spam" },
  // Task
  TODO:            { bg: "hsl(0 0% 42% / 0.12)",    color: "hsl(0 0% 60%)",     label: "Por hacer" },
  DONE:            { bg: "hsl(145 63% 42% / 0.12)", color: "hsl(145 63% 52%)",  label: "Listo" },
  // Document
  UPLOADED:        { bg: "hsl(214 89% 52% / 0.12)", color: "hsl(214 89% 62%)",  label: "Subido" },
  PROCESSING:      { bg: "hsl(38 95% 54% / 0.12)",  color: "hsl(38 95% 60%)",   label: "Procesando" },
  PROCESSED:       { bg: "hsl(145 63% 42% / 0.12)", color: "hsl(145 63% 52%)",  label: "Procesado" },
  FAILED:          { bg: "hsl(0 72% 51% / 0.12)",   color: "hsl(0 72% 62%)",    label: "Error" },
  // Invoice / shared
  DRAFT:           { bg: "hsl(0 0% 42% / 0.12)",    color: "hsl(0 0% 60%)",     label: "Borrador" },
  SENT:            { bg: "hsl(214 89% 52% / 0.12)", color: "hsl(214 89% 62%)",  label: "Enviada" },
  PENDING_APPROVAL:{ bg: "hsl(38 95% 54% / 0.12)",  color: "hsl(38 95% 60%)",   label: "Pend. aprob." },
  PARTIALLY_PAID:  { bg: "hsl(38 95% 54% / 0.12)",  color: "hsl(38 95% 60%)",   label: "Abonada" },
  PAID:            { bg: "hsl(145 63% 42% / 0.12)", color: "hsl(145 63% 52%)",  label: "Pagada" },
  OVERDUE:         { bg: "hsl(0 72% 51% / 0.12)",   color: "hsl(0 72% 62%)",    label: "Vencida" },
  CANCELLED:       { bg: "hsl(0 0% 42% / 0.12)",    color: "hsl(0 0% 60%)",     label: "Cancelada" },
  // Hacienda (fiscal)
  PENDING_SUBMISSION: { bg: "hsl(38 95% 54% / 0.12)", color: "hsl(38 95% 60%)", label: "Pend. envío" },
  SUBMITTED:       { bg: "hsl(214 89% 52% / 0.12)", color: "hsl(214 89% 62%)",  label: "Enviado MH" },
  RECIBIDO:        { bg: "hsl(214 89% 52% / 0.12)", color: "hsl(214 89% 62%)",  label: "Recibido MH" },
  PROCESANDO:      { bg: "hsl(38 95% 54% / 0.12)",  color: "hsl(38 95% 60%)",   label: "Procesando MH" },
  ACEPTADO:        { bg: "hsl(145 63% 42% / 0.12)", color: "hsl(145 63% 52%)",  label: "Aceptado MH" },
  RECHAZADO:       { bg: "hsl(0 72% 51% / 0.12)",   color: "hsl(0 72% 62%)",    label: "Rechazado MH" },
  ERROR:           { bg: "hsl(0 72% 51% / 0.12)",   color: "hsl(0 72% 62%)",    label: "Error MH" },
  // Agent
  ACTIVE:          { bg: "hsl(145 63% 42% / 0.12)", color: "hsl(145 63% 52%)",  label: "Activo" },
  INACTIVE:        { bg: "hsl(0 0% 42% / 0.12)",    color: "hsl(0 0% 60%)",     label: "Pausado" },
  TESTING:         { bg: "hsl(38 95% 54% / 0.12)",  color: "hsl(38 95% 60%)",   label: "En prueba" },
};

const FALLBACK = { bg: "hsl(0 0% 42% / 0.10)", color: "hsl(0 0% 55%)" };

interface StatusBadgeProps {
  status: string;
  type: "conversation" | "task" | "document" | "invoice";
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const s = STYLES[status] ?? FALLBACK;
  return (
    <span
      className={cn("inline-flex items-center shrink-0", className)}
      style={{
        background: s.bg,
        color: s.color,
        fontSize: "11px",
        fontWeight: 500,
        lineHeight: 1,
        padding: "3px 7px",
        borderRadius: "4px",
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
      }}
      data-testid={`status-badge-${status.toLowerCase()}`}
    >
      {s.label ?? status.replace(/_/g, " ")}
    </span>
  );
}
