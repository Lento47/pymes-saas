/**
 * InteractiveAttachment — native-looking interactive messages for WhatsApp and Telegram.
 *
 * All interactive types now use channel theme colors (getChannelTheme) so they
 * match the surrounding bubble palette — no hardcoded bg-primary/muted.
 *
 * WhatsApp: green bubbles, full-width buttons below separator.
 * Telegram: bubble + blue pill keyboard below.
 * Reply confirmations: compact card matching channel palette.
 * Dark mode: all variants adapt via theme + dark: overrides.
 */
import { Check, List, MapPin } from "lucide-react";
import { SensitiveText } from "@/components/shared/sensitive-text";
import { cn } from "@/lib/utils";
import { getChannelTheme } from "@/features/inbox/channel-theme";

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
  const theme = getChannelTheme(provider);

  // Channel-aware bubble + text classes
  const surfaceCls = isOutbound ? theme.outboundCls : theme.inboundCls;
  const textCls    = isOutbound ? theme.outboundTextCls : theme.inboundTextCls;
  const metaCls    = isOutbound ? theme.outboundMetaCls : theme.inboundMetaCls;

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

    return (
      <div className={cn("flex flex-col rounded-xl px-3 py-2.5 max-w-[86%] sm:max-w-[360px]", surfaceCls, className)}>
        <span className={cn("mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider", metaCls)}>
          <Check className="h-3 w-3" />
          {selectedLabel}
        </span>
        {title && (
          <p className={cn("text-[13.5px] font-medium leading-snug", textCls)}>
            <SensitiveText text={title} />
          </p>
        )}
        {description && (
          <p className={cn("mt-0.5 text-[11px] leading-snug opacity-70", textCls)}>
            <SensitiveText text={description} />
          </p>
        )}
      </div>
    );
  }

  // ── Location request ─────────────────────────────────────────────────────────
  if (interactiveType === "location_request") {
    const locationText = body ?? fallbackText ?? "Comparte tu ubicación para continuar";
    const borderCls = isOutbound ? "border-white/15" : "border-border/50";

    return (
      <div className={cn("flex flex-col rounded-2xl overflow-hidden max-w-[84%] sm:max-w-[68%]", surfaceCls, className)}>
        <div className="px-3.5 pt-3 pb-2">
          <p className={cn("text-[13.5px] sm:text-[14px] leading-relaxed whitespace-pre-wrap break-words", textCls)}>
            <SensitiveText text={locationText} />
          </p>
        </div>
        <div className={cn("flex items-center gap-2 px-3.5 py-2 border-t", borderCls)}>
          <MapPin className={cn("h-3.5 w-3.5 shrink-0", isOutbound ? "text-white/80 dark:text-white/70" : theme.inboundLinkCls)} />
          <span className={cn("text-[12px] font-medium", isOutbound ? "text-white/80 dark:text-white/70" : theme.inboundLinkCls)}>
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
        "flex flex-col rounded-2xl overflow-hidden max-w-[84%] sm:max-w-[68%]",
        surfaceCls,
        className,
      )}>
        {primaryText && (
          <div className="px-3.5 pt-3 pb-2.5">
            <p className={cn("text-[13.5px] sm:text-[14px] leading-relaxed whitespace-pre-wrap break-words", textCls)}>
              <SensitiveText text={primaryText} />
            </p>
            {footer && (
              <p className={cn("mt-1 text-[10px] leading-snug opacity-50", textCls)}>
                <SensitiveText text={footer} />
              </p>
            )}
          </div>
        )}
        <div className={cn("flex flex-col border-t", isOutbound ? "border-white/15 dark:border-white/10" : "border-black/[0.08] dark:border-white/10")}>
          {buttons.map((btn, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center justify-center gap-1.5 border-t first:border-0 px-3.5 py-2 cursor-default select-none",
                isOutbound ? "border-white/10 dark:border-white/10" : "border-black/[0.06] dark:border-white/10",
              )}
            >
              <span className={cn("text-[13px] font-medium", isOutbound ? "text-[#075e54] dark:text-[#53bdeb]" : "text-[#075e54] dark:text-[#53bdeb]")}>
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
        "flex flex-col rounded-2xl overflow-hidden max-w-[84%] sm:max-w-[68%]",
        surfaceCls,
        className,
      )}>
        {primaryText && (
          <div className="px-3.5 pt-3 pb-2.5">
            <p className={cn("text-[13.5px] sm:text-[14px] leading-relaxed whitespace-pre-wrap break-words", textCls)}>
              <SensitiveText text={primaryText} />
            </p>
            {footer && (
              <p className={cn("mt-1 text-[10px] leading-snug opacity-50", textCls)}>
                <SensitiveText text={footer} />
              </p>
            )}
          </div>
        )}
        {/* List sections preview (collapsed — shows section titles) */}
        {hasSections && (
          <div className="px-3.5 pb-2 space-y-0.5">
            {sections!.flatMap(s => s.rows).slice(0, 3).map((row, i) => (
              <p key={i} className={cn("text-[11px] truncate opacity-60", textCls)}>
                · <SensitiveText text={row.title} />
              </p>
            ))}
            {sections!.flatMap(s => s.rows).length > 3 && (
              <p className={cn("text-[11px] opacity-50", textCls)}>
                + {sections!.flatMap(s => s.rows).length - 3} más
              </p>
            )}
          </div>
        )}
        <div className={cn("flex items-center justify-center gap-1.5 border-t px-3.5 py-2.5", isOutbound ? "border-white/15" : "border-black/[0.08] dark:border-white/10")}>
          <List className={cn("h-3.5 w-3.5 shrink-0", isOutbound ? "text-[#075e54] dark:text-[#53bdeb]" : "text-[#075e54] dark:text-[#53bdeb]")} />
          <span className={cn("text-[13px] font-medium", isOutbound ? "text-[#075e54] dark:text-[#53bdeb]" : "text-[#075e54] dark:text-[#53bdeb]")}>
            {actionLabel ?? "Ver opciones"}
          </span>
        </div>
      </div>
    );
  }

  // ── Telegram inline keyboard ─────────────────────────────────────────────────
  if (isTelegram && hasButtons) {
    return (
      <div className={cn("flex flex-col max-w-[84%] sm:max-w-[68%] rounded-2xl overflow-visible", className)}>
        {primaryText && (
          <div className={cn("px-3.5 py-2.5 rounded-2xl shadow-sm", surfaceCls)}>
            <p className={cn("text-[13.5px] sm:text-[14px] leading-relaxed whitespace-pre-wrap break-words", textCls)}>
              <SensitiveText text={primaryText} />
            </p>
            {footer && (
              <p className={cn("mt-1 text-[10px] leading-snug opacity-50", textCls)}>
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
              className="inline-flex items-center rounded-xl border border-[#2481cc]/20 bg-[#2481cc]/10 px-3 py-1.5 text-[12px] font-medium text-[#2481cc] dark:border-[#6ab2f2]/30 dark:bg-[#6ab2f2]/10 dark:text-[#6ab2f2] cursor-default select-none"
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

  return (
    <div className={cn(
      "flex flex-col rounded-2xl overflow-hidden max-w-[84%] sm:max-w-[68%]",
      surfaceCls,
      className,
    )}>
      <div className="px-3.5 py-2.5">
        {title && title !== fallbackText2 && (
          <p className={cn("text-[11px] font-medium mb-1 opacity-70", textCls)}>
            <SensitiveText text={title} />
          </p>
        )}
        <p className={cn("text-[13.5px] sm:text-[14px] leading-relaxed whitespace-pre-wrap break-words", textCls)}>
          <SensitiveText text={fallbackText2} />
        </p>
        {footer && (
          <p className={cn("mt-1 text-[10px] leading-snug opacity-50", textCls)}>
            <SensitiveText text={footer} />
          </p>
        )}
      </div>
    </div>
  );
}
