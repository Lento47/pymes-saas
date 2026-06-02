/**
 * InteractiveAttachment — native-looking interactive messages for WhatsApp and Telegram.
 *
 * WhatsApp outbound (button / list): text body + tappable buttons at the bottom,
 * separated by a thin rule — matches WhatsApp native UI.
 * Telegram inline keyboard: blue pills below the message text.
 * Reply confirmations (button_reply / list_reply / nfm_reply): selected item card
 * without the Discord embed style.
 * Location request: location pin + body text + action row.
 */
import { Check, List, MapPin } from "lucide-react";
import { SensitiveText } from "@/components/shared/sensitive-text";
import { cn } from "@/lib/utils";

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
  isOutbound?: boolean;
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
  isOutbound = false,
}: InteractiveAttachmentProps) {
  const isWhatsApp = provider === "WHATSAPP";
  const isTelegram = provider === "TELEGRAM";
  const primaryText = body ?? fallbackText ?? "";
  const hasButtons = buttons && buttons.length > 0;
  const hasSections = sections && sections.length > 0;

  // ── Reply confirmations (user selected an option) ────────────────────────────
  if (
    interactiveType === "button_reply" ||
    interactiveType === "list_reply" ||
    interactiveType === "nfm_reply"
  ) {
    const selectedLabel =
      interactiveType === "list_reply"
        ? "Opción seleccionada"
        : interactiveType === "nfm_reply"
          ? "Respuesta enviada"
          : "Respuesta";

    const bubbleCls = isOutbound
      ? "bg-primary/[0.07] border border-primary/15 text-foreground"
      : "bg-muted/40 border border-border/40 text-foreground";

    return (
      <div className={cn("flex flex-col rounded-xl px-3 py-2.5 max-w-[86%] sm:max-w-[360px]", bubbleCls, className)}>
        <span className="mb-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">
          <Check className="h-3 w-3" />
          {selectedLabel}
        </span>
        {title && (
          <p className="text-[13.5px] font-medium leading-snug">
            <SensitiveText text={title} />
          </p>
        )}
        {description && (
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground/75">
            <SensitiveText text={description} />
          </p>
        )}
      </div>
    );
  }

  // ── Location request ─────────────────────────────────────────────────────────
  if (interactiveType === "location_request") {
    const locationText = body ?? fallbackText ?? "Comparte tu ubicación para continuar";
    const bubbleCls = isOutbound
      ? "bg-primary text-primary-foreground shadow-[0_1px_3px_rgba(79,70,229,0.18)]"
      : "bg-card border border-border/40";

    return (
      <div className={cn("flex flex-col rounded-2xl rounded-br-sm overflow-hidden max-w-[84%] sm:max-w-[68%]", bubbleCls, className)}>
        <div className="px-3.5 pt-3 pb-2">
          <p className={cn("text-[13.5px] sm:text-[14px] leading-relaxed whitespace-pre-wrap break-words", isOutbound ? "text-primary-foreground" : "text-foreground")}>
            <SensitiveText text={locationText} />
          </p>
        </div>
        <div className={cn("flex items-center gap-2 px-3.5 py-2 border-t", isOutbound ? "border-white/15" : "border-border/50")}>
          <MapPin className={cn("h-3.5 w-3.5 shrink-0", isOutbound ? "text-white/80" : "text-primary")} />
          <span className={cn("text-[12px] font-medium", isOutbound ? "text-white/80" : "text-primary")}>
            {actionLabel ?? "Enviar ubicación"}
          </span>
        </div>
      </div>
    );
  }

  // ── WhatsApp button message ───────────────────────────────────────────────────
  if (isWhatsApp && interactiveType === "button" && hasButtons) {
    return (
      <div className={cn(
        "flex flex-col rounded-2xl rounded-br-sm overflow-hidden max-w-[84%] sm:max-w-[68%] bg-primary text-primary-foreground shadow-[0_1px_3px_rgba(79,70,229,0.18)]",
        className,
      )}>
        {primaryText && (
          <div className="px-3.5 pt-3 pb-2.5">
            <p className="text-[13.5px] sm:text-[14px] leading-relaxed whitespace-pre-wrap break-words text-primary-foreground">
              <SensitiveText text={primaryText} />
            </p>
            {footer && (
              <p className="mt-1 text-[10px] text-white/50 leading-snug">
                <SensitiveText text={footer} />
              </p>
            )}
          </div>
        )}
        <div className="flex flex-col border-t border-white/15">
          {buttons.map((btn, i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-1.5 border-t border-white/10 first:border-0 px-3.5 py-2 cursor-default select-none"
            >
              <span className="text-[13px] font-medium text-white/90">
                <SensitiveText text={btn.title} />
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── WhatsApp list message ─────────────────────────────────────────────────────
  if (isWhatsApp && (interactiveType === "list" || hasSections) && !hasButtons) {
    return (
      <div className={cn(
        "flex flex-col rounded-2xl rounded-br-sm overflow-hidden max-w-[84%] sm:max-w-[68%] bg-primary text-primary-foreground shadow-[0_1px_3px_rgba(79,70,229,0.18)]",
        className,
      )}>
        {primaryText && (
          <div className="px-3.5 pt-3 pb-2.5">
            <p className="text-[13.5px] sm:text-[14px] leading-relaxed whitespace-pre-wrap break-words text-primary-foreground">
              <SensitiveText text={primaryText} />
            </p>
            {footer && (
              <p className="mt-1 text-[10px] text-white/50 leading-snug">
                <SensitiveText text={footer} />
              </p>
            )}
          </div>
        )}
        {/* List sections preview (collapsed — shows section titles) */}
        {hasSections && (
          <div className="px-3.5 pb-2 space-y-0.5">
            {sections!.flatMap(s => s.rows).slice(0, 3).map((row, i) => (
              <p key={i} className="text-[11px] text-white/60 truncate">
                · <SensitiveText text={row.title} />
              </p>
            ))}
            {sections!.flatMap(s => s.rows).length > 3 && (
              <p className="text-[11px] text-white/50">
                + {sections!.flatMap(s => s.rows).length - 3} más
              </p>
            )}
          </div>
        )}
        <div className="flex items-center justify-center gap-1.5 border-t border-white/15 px-3.5 py-2.5">
          <List className="h-3.5 w-3.5 text-white/80 shrink-0" />
          <span className="text-[13px] font-medium text-white/90">
            {actionLabel ?? "Ver opciones"}
          </span>
        </div>
      </div>
    );
  }

  // ── Telegram inline keyboard ─────────────────────────────────────────────────
  if (isTelegram && hasButtons) {
    const bubbleCls = isOutbound
      ? "bg-[#effdde]"
      : "bg-white";

    return (
      <div className={cn("flex flex-col max-w-[84%] sm:max-w-[68%] rounded-2xl rounded-br-sm overflow-visible shadow-sm", className)}>
        {primaryText && (
          <div className={cn("px-3.5 py-2.5 rounded-2xl rounded-br-sm", bubbleCls)}>
            <p className="text-[13.5px] sm:text-[14px] leading-relaxed whitespace-pre-wrap break-words text-[#111827]">
              <SensitiveText text={primaryText} />
            </p>
            {footer && (
              <p className="mt-1 text-[10px] text-[#111827]/45 leading-snug">
                <SensitiveText text={footer} />
              </p>
            )}
          </div>
        )}
        {/* Inline keyboard buttons below the bubble */}
        <div className="mt-1 flex flex-wrap gap-1">
          {buttons.map((btn, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-xl border border-[#2481cc]/20 bg-[#2481cc]/10 px-3 py-1.5 text-[12px] font-medium text-[#2481cc] cursor-default select-none"
            >
              <SensitiveText text={btn.title} />
            </span>
          ))}
        </div>
      </div>
    );
  }

  // ── Fallback: generic interactive message ────────────────────────────────────
  const fallbackText2 = primaryText || title || "Mensaje interactivo";
  const bubbleCls = isOutbound
    ? "bg-primary text-primary-foreground shadow-[0_1px_3px_rgba(79,70,229,0.18)]"
    : "bg-card border border-border/40 shadow-[0_1px_2px_rgba(0,0,0,0.04)]";
  const textColorCls = isOutbound ? "text-primary-foreground" : "text-foreground";

  return (
    <div className={cn(
      "flex flex-col rounded-2xl overflow-hidden max-w-[84%] sm:max-w-[68%]",
      bubbleCls,
      className,
    )}>
      <div className="px-3.5 py-2.5">
        {title && title !== fallbackText2 && (
          <p className={cn("text-[11px] font-medium mb-1 opacity-70", textColorCls)}>
            <SensitiveText text={title} />
          </p>
        )}
        <p className={cn("text-[13.5px] sm:text-[14px] leading-relaxed whitespace-pre-wrap break-words", textColorCls)}>
          <SensitiveText text={fallbackText2} />
        </p>
        {footer && (
          <p className={cn("mt-1 text-[10px] leading-snug opacity-50", textColorCls)}>
            <SensitiveText text={footer} />
          </p>
        )}
      </div>
    </div>
  );
}
