import { SensitiveText } from "@/components/shared/sensitive-text";
import { cn } from "@/lib/utils";
import { ListChecks, MapPin, MessageSquareReply, MousePointerClick } from "lucide-react";

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
}

function getInteractiveLabel(type?: string | null) {
  switch (type) {
    case "button_reply":
      return "Respuesta de botón";
    case "list_reply":
      return "Respuesta de lista";
    case "button":
      return "Botones de respuesta";
    case "list":
      return "Lista interactiva";
    case "location_request":
    case "location_request_message":
      return "Solicitud de ubicación";
    default:
      return "Mensaje interactivo";
  }
}

function getInteractiveIcon(type?: string | null) {
  if (type === "list" || type === "list_reply") return ListChecks;
  if (type === "location_request" || type === "location_request_message") return MapPin;
  if (type === "button" || type === "button_reply") return MousePointerClick;
  return MessageSquareReply;
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
}: InteractiveAttachmentProps) {
  const Icon = getInteractiveIcon(interactiveType);
  const label = getInteractiveLabel(interactiveType);
  const primaryText = body ?? fallbackText ?? label;
  const replyText = title && title !== primaryText ? title : null;
  const hasButtons = buttons && buttons.length > 0;
  const hasSections = sections && sections.length > 0;

  return (
    <div className={cn("flex min-w-[240px] max-w-[360px] flex-col overflow-hidden rounded-xl border border-border/55 bg-card/80 shadow-sm", className)}>
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70">
            {label}
          </div>
          {primaryText && (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-snug text-foreground">
              <SensitiveText text={primaryText} />
            </p>
          )}
          {replyText && (
            <p className="mt-1 rounded-lg bg-muted/50 px-2 py-1.5 text-sm font-medium leading-snug text-foreground">
              <SensitiveText text={replyText} />
            </p>
          )}
          {description && (
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground/80">
              <SensitiveText text={description} />
            </p>
          )}
          {footer && (
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground/60">
              <SensitiveText text={footer} />
            </p>
          )}
        </div>
      </div>

      {hasButtons && (
        <div className="border-t border-border/45 bg-muted/[0.18]">
          {buttons.map((button, index) => (
            <div key={`${button.title}-${index}`} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary">
              <MousePointerClick className="h-3.5 w-3.5 shrink-0" />
              <SensitiveText text={button.title} />
            </div>
          ))}
        </div>
      )}

      {hasSections && (
        <div className="border-t border-border/45 bg-muted/[0.18] px-3 py-2">
          {actionLabel && <div className="mb-1.5 text-[11px] font-medium text-primary">{actionLabel}</div>}
          <div className="space-y-2">
            {sections.map((section, sectionIndex) => (
              <div key={`${section.title ?? "section"}-${sectionIndex}`}>
                {section.title && (
                  <div className="mb-1 text-[11px] font-medium text-muted-foreground">
                    <SensitiveText text={section.title} />
                  </div>
                )}
                <div className="space-y-1">
                  {section.rows.map((row, rowIndex) => (
                    <div key={`${row.title}-${rowIndex}`} className="rounded-lg bg-background/65 px-2 py-1.5">
                      <div className="text-sm font-medium leading-snug">
                        <SensitiveText text={row.title} />
                      </div>
                      {row.description && (
                        <div className="text-[11px] leading-snug text-muted-foreground/80">
                          <SensitiveText text={row.description} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
