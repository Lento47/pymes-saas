/**
 * PymesHub IA — Chat Preview Component
 * Copy-paste into any React + Tailwind project.
 * Dependencies: lucide-react (icons only)
 */
import { useState } from "react";
import { Check, CheckCheck, Reply, ChevronDown, AlertCircle, CheckCircle2 } from "lucide-react";

/* ── Channel Themes ─────────────────────────────────────────────────── */
const THEMES = {
  whatsapp: {
    label: "WhatsApp",
    bg: "bg-[#EFEAE2] dark:bg-[#0b141a]",
    headerBg: "bg-[#008069] dark:bg-[#202c33]",
    inbound: "bg-white dark:bg-[#202c33]",
    outbound: "bg-[#D9FDD3] dark:bg-[#005c4b]",
    text: "text-[#111b21] dark:text-[#e9edef]",
    meta: "text-[#667781] dark:text-[#8696a0]",
    quote: "bg-black/5 dark:bg-white/5 border-l-[3px] border-[#06cf9c]",
  },
  telegram: {
    label: "Telegram",
    bg: "bg-[#E8DDD3] dark:bg-[#0e1621]",
    headerBg: "bg-[#517DA2] dark:bg-[#1c2939]",
    inbound: "bg-white dark:bg-[#182533]",
    outbound: "bg-[#EFFDDE] dark:bg-[#2b5278]",
    text: "text-[#232323] dark:text-[#f5f5f5]",
    meta: "text-[#6e8d6d] dark:text-[#6d7f8e]",
    quote: "bg-black/5 dark:bg-white/5 border-l-[3px] border-[#517DA2]",
  },
} as const;

type Channel = keyof typeof THEMES;

/* ── AI Inline Separator ────────────────────────────────────────────── */
function AIInlineSeparator({ status, variant = "running" }: { status: string; variant?: "running" | "done" | "error" }) {
  const colors = {
    running: { pill: "border-violet-100 bg-violet-50 dark:border-violet-800 dark:bg-violet-950", text: "text-violet-700 dark:text-violet-400", dot: "bg-violet-500", ping: "bg-violet-400", line: "bg-slate-200 dark:bg-slate-700" },
    done:    { pill: "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500", ping: "bg-emerald-400", line: "bg-emerald-200 dark:bg-emerald-800" },
    error:   { pill: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950", text: "text-red-700 dark:text-red-400", dot: "bg-red-500", ping: "bg-red-400", line: "bg-red-200 dark:bg-red-800" },
  }[variant];

  return (
    <div className="flex items-center gap-3 px-3 py-1.5">
      <div className={`h-px flex-1 ${colors.line}`} />
      <div className={`flex items-center gap-2 rounded-full border px-3 py-1 ${colors.pill}`}>
        {variant === "running" && (
          <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${colors.ping}`} />
            <span className={`relative inline-flex h-2 w-2 rounded-full ${colors.dot}`} />
          </span>
        )}
        {variant === "done" && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
        {variant === "error" && <AlertCircle className="h-3 w-3 text-red-500" />}
        <span className={`text-xs font-medium whitespace-nowrap ${colors.text}`}>PymesHub IA · {status}</span>
      </div>
      <div className={`h-px flex-1 ${colors.line}`} />
    </div>
  );
}

/* ── Message Bubble ─────────────────────────────────────────────────── */
function MessageBubble({
  text, time, isOutbound, isConsecutive = false, quotedText, channel,
}: {
  text: string; time: string; isOutbound: boolean;
  isConsecutive?: boolean; quotedText?: string; channel: Channel;
}) {
  const [hovered, setHovered] = useState(false);
  const t = THEMES[channel];
  const radius = isConsecutive ? "rounded-2xl" : isOutbound ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-bl-md";

  return (
    <div className={`flex gap-2 px-1 ${isOutbound ? "justify-end" : ""}`}>
      {/* Avatar (inbound, first in group) */}
      {!isOutbound && !isConsecutive && (
        <div className="mt-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-300 dark:bg-slate-600 text-[10px] font-semibold text-white">
          MG
        </div>
      )}
      {!isOutbound && isConsecutive && <div className="w-7 shrink-0" />}

      <div className="group/bubble relative min-w-0">
        <div
          className={`${radius} ${isOutbound ? t.outbound : t.inbound} ${isConsecutive ? "mt-0.5" : "mt-3"} px-3.5 py-2 max-w-[84%] sm:max-w-[68%]`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* Reply quote */}
          {quotedText && (
            <div className={`${t.quote} rounded-md px-2.5 py-1.5 mb-1.5`}>
              <p className="text-[11px] font-medium text-[#06cf9c] mb-0.5">María González</p>
              <p className="text-[12px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-snug">{quotedText}</p>
            </div>
          )}

          {/* Text */}
          <p className={`text-[14.2px] leading-[19px] break-words whitespace-pre-wrap ${t.text}`}>
            {text}
          </p>

          {/* Meta */}
          <span className={`float-right ml-2 mt-0.5 flex items-center gap-0.5 text-[11px] ${t.meta}`}>
            {time}
            {isOutbound && <CheckCheck className="h-3.5 w-3.5 text-[#53BDEB]" />}
          </span>
          <div className="clear-both" />
        </div>

        {/* Desktop reply hover */}
        {hovered && (
          <button className={`absolute top-1/2 -translate-y-1/2 hidden sm:flex h-7 w-7 items-center justify-center rounded-full border border-border/40 bg-background/90 text-muted-foreground shadow-sm hover:bg-muted z-10 ${isOutbound ? "-left-9" : "-right-9"}`}>
            <Reply className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Main Preview ───────────────────────────────────────────────────── */
export default function ChatPreview() {
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const t = THEMES[channel];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 p-4 sm:p-8">
      {/* Channel switcher */}
      <div className="mx-auto max-w-lg mb-4 flex gap-2">
        {(["whatsapp", "telegram"] as const).map((ch) => (
          <button
            key={ch}
            onClick={() => setChannel(ch)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              channel === ch ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            {THEMES[ch].label}
          </button>
        ))}
      </div>

      {/* Chat container */}
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-lg">
        {/* Header */}
        <div className={`${t.headerBg} px-5 py-3.5`}>
          <h2 className="text-sm font-semibold text-white">María González</h2>
          <p className="text-xs text-white/70">en línea</p>
        </div>

        {/* Chat body */}
        <div className={`${t.bg} px-3 py-4 space-y-0.5`}>
          {/* Customer messages */}
          <MessageBubble text="Hola, ¿hacen entregas a domicilio hoy?" time="10:41" isOutbound={false} channel={channel} />
          <MessageBubble text="Necesito que me envíen 2 cajas de empanadas" time="10:41" isOutbound={false} isConsecutive channel={channel} />

          {/* AI thinking */}
          <AIInlineSeparator status="analizando mensaje" />

          {/* AI reply with quote */}
          <MessageBubble
            text="¡Hola María! Sí, hoy tenemos entregas disponibles 🚚 Para confirmarte horario y costo, ¿me podés indicar tu dirección de entrega?"
            time="10:42"
            isOutbound
            channel={channel}
          />

          {/* Customer reply with quote */}
          <MessageBubble
            text="Calle 5, Barrio Los Ángeles, casa con portón azul"
            time="10:43"
            isOutbound={false}
            quotedText="¡Hola María! Sí, hoy tenemos entregas disponibles 🚚 Para confirmarte horario y costo..."
            channel={channel}
          />

          {/* AI done separator */}
          <AIInlineSeparator status="respuesta lista" variant="done" />

          {/* Final AI message */}
          <MessageBubble
            text="Perfecto, tu dirección está confirmada. El envío tiene un costo de ₡1,500 y llega entre 2:00 y 3:00 pm de hoy. ¿Querés que confirme el pedido?"
            time="10:43"
            isOutbound
            channel={channel}
          />

          {/* Customer confirms */}
          <MessageBubble text="Sí, por favor confirmen 👍" time="10:44" isOutbound={false} channel={channel} />
        </div>

        {/* Composer bar */}
        <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-3 py-2.5 flex items-center gap-2">
          <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-2.5">
            <span className="text-sm text-slate-400 dark:text-slate-500">Escribe un mensaje...</span>
          </div>
          <div className="h-10 w-10 rounded-full bg-[#008069] dark:bg-[#00a884] flex items-center justify-center">
            <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.128 1.816-13.128 1.817-.011 7.912z" /></svg>
          </div>
        </div>
      </div>
    </div>
  );
}
