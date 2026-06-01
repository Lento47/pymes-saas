import { SensitiveText } from "@/components/shared/sensitive-text";
import { cn } from "@/lib/utils";
import { MessageCircle } from "lucide-react";

interface InteractiveAttachmentProps {
  interactiveType?: string | null;
  title?: string | null;
  body?: string | null;
  description?: string | null;
  footer?: string | null;
  actionLabel?: string | null;
  buttons?: Array<{ title: string }>;
  sections?: Array<{ title?: string | null; rows: Array<{ title: string; description?: string | null }> }>;
  fallbackText?: string | null;
  className?: string;
  provider?: string | null;
}

function accentForType(type?: string | null, provider?: string | null) {
  const isWhatsApp = provider === "WHATSAPP";

  switch (type) {
    case "button_reply": return "border-emerald-500/60";
    case "list_reply":   return "border-amber-500/60";
    case "nfm_reply":    return "border-violet-500/60";
    case "button":       return isWhatsApp ? "border-primary/40" : "border-sky-500/60";
    case "list":         return isWhatsApp ? "border-primary/40" : "border-amber-500/60";
    default:             return "border-border";
  }
}

export function InteractiveAttachment({
  interactiveType,
  title,
  body,
  description,
  footer,
  actionLabel,
  buttons,
  sections,
  fallbackText,
  className,
  provider,
}: InteractiveAttachmentProps) {
  const primaryText = body ?? fallbackText ?? "Mensaje interactivo";
  const replyTitle = title && title !== primaryText ? title : null;
  const hasButtons = buttons && buttons.length > 0;
  const hasSections = sections && sections.length > 0;

  return (
    <div className={cn(
      "flex flex-col gap-2 rounded-xl border border-border/50 bg-card/60 p-3",
      accentForType(interactiveType, provider),
      "border-l-[3px]", // Discord embed style — colored left border
      className,
    )}>
      {/* Selected option — highlighted inside the embed */}
      {replyTitle && (
        <div className="rounded-lg bg-primary/[0.06] px-3 py-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground/60">
            {interactiveType === "list_reply" ? "Opción seleccionada" : "Respuesta"}
          </span>
          <p className="mt-0.5 text-sm font-medium leading-snug text-foreground">
            <SensitiveText text={replyTitle} />
          </p>
        </div>
      )}

      {/* Body text (what the user sees as the main message) */}
      {primaryText && !replyTitle && (
        <p className="text-sm leading-snug text-foreground">
          <SensitiveText text={primaryText} />
        </p>
      )}

      {description && (
        <p className="text-[11px] leading-snug text-muted-foreground/70">
          <SensitiveText text={description} />
        </p>
      )}

      {/* Buttons */}
      {hasButtons && (
        <div className="flex flex-wrap gap-1.5">
          {buttons.map((button, i) => {
            const isTelegram = provider === "TELEGRAM";
            const isWhatsApp = provider === "WHATSAPP";

            let buttonClass = "border border-border/60 bg-muted/40 text-foreground/80";
            if (isTelegram) buttonClass = "bg-sky-600 text-white shadow-sm hover:bg-sky-500 active:bg-sky-700";
            if (isWhatsApp) buttonClass = "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:bg-primary/80";

            return (
              <span
                key={i}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[13px] font-medium transition-colors select-none",
                  buttonClass
                )}
              >
                {isWhatsApp && <MessageCircle className="h-3.5 w-3.5" />}
                <SensitiveText text={button.title} />
              </span>
            );
          })}
        </div>
      )}

      {/* List sections */}
      {hasSections && (
        <div className="space-y-2">
          {actionLabel && (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/70">
              {provider === "WHATSAPP" && <MessageCircle className="h-3 w-3" />}
              {actionLabel}
            </span>
          )}
          {sections.map((section, si) => (
            <div key={si}>
              {section.title && (
                <span className="text-[11px] font-medium text-muted-foreground/60">{section.title}</span>
              )}
              <div className="mt-1 space-y-1">
                {section.rows.map((row, ri) => (
                  <div key={ri} className="rounded-md border border-border/40 bg-background/50 px-2.5 py-1.5">
                    <span className="text-[13px] font-medium leading-snug text-foreground/85">
                      <SensitiveText text={row.title} />
                    </span>
                    {row.description && (
                      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground/70">
                        <SensitiveText text={row.description} />
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {footer && (
        <p className="text-[10px] leading-snug text-muted-foreground/50">{footer}</p>
      )}
    </div>
  );
}
