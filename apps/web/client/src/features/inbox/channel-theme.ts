import type React from "react";

export interface ChannelTheme {
  // Chat surface
  surfaceCls: string;
  surfaceStyle: React.CSSProperties;

  // Bubble backgrounds (include text color)
  outboundCls: string;
  inboundCls: string;

  // SVG tail fill (inline CSS color string) — unused since CSS-only corners
  outboundTailColor: string;
  inboundTailColor: string;

  // Text inside bubbles
  outboundTextCls: string;
  inboundTextCls: string;

  // Links inside bubbles
  outboundLinkCls: string;
  inboundLinkCls: string;

  // Inline code
  outboundCodeCls: string;
  inboundCodeCls: string;

  // Code block (pre)
  outboundPreCls: string;
  inboundPreCls: string;

  // Timestamp / status meta row
  outboundMetaCls: string;
  inboundMetaCls: string;

  // Status icon variant — 'light' for dark bubbles, 'dark' for light bubbles
  statusVariant: "light" | "dark";

  // Reply quote styles
  outboundQuoteCls: string;
  inboundQuoteCls: string;
  outboundQuoteSenderCls: string;
  inboundQuoteSenderCls: string;
  outboundQuoteTextCls: string;
  inboundQuoteTextCls: string;
}

/* Default dot-pattern surface — uses CSS custom properties so dark: variant can
   flip the dot color from black-on-white to white-on-dark. */
const DEFAULT_SURFACE_STYLE: React.CSSProperties = {
  backgroundImage: "radial-gradient(circle, var(--surface-dot) 1px, transparent 1px)",
  backgroundSize: "20px 20px",
  backgroundColor: "var(--surface-bg)",
};

export const DEFAULT_THEME: ChannelTheme = {
  surfaceCls: "[--surface-dot:rgba(0,0,0,0.045)] [--surface-bg:theme(colors.muted.DEFAULT)] dark:[--surface-dot:rgba(255,255,255,0.04)] dark:[--surface-bg:theme(colors.background)]",
  surfaceStyle: DEFAULT_SURFACE_STYLE,

  outboundCls: "bg-primary text-primary-foreground shadow-[0_1px_3px_rgba(79,70,229,0.18)]",
  inboundCls: "bg-card border border-border/40 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)]",

  outboundTailColor: "hsl(var(--primary))",
  inboundTailColor: "hsl(var(--card))",

  outboundTextCls: "text-primary-foreground",
  inboundTextCls: "text-foreground",

  outboundLinkCls: "text-white/90 underline decoration-white/30",
  inboundLinkCls: "text-primary hover:underline",

  outboundCodeCls: "bg-white/15 px-1 py-0.5 rounded font-mono text-[12.5px]",
  inboundCodeCls: "bg-muted/70 px-1 py-0.5 rounded font-mono text-[12.5px]",

  outboundPreCls: "bg-white/10 p-2 rounded-md font-mono text-[12px] overflow-x-auto my-1",
  inboundPreCls: "bg-muted/70 p-2 rounded-md font-mono text-[12px] overflow-x-auto my-1",

  outboundMetaCls: "text-white/50",
  inboundMetaCls: "text-muted-foreground/45",

  statusVariant: "light",

  outboundQuoteCls: "border-l-2 border-white/40 bg-white/10",
  inboundQuoteCls: "border-l-2 border-primary/50 bg-primary/[0.06]",
  outboundQuoteSenderCls: "text-white/70",
  inboundQuoteSenderCls: "text-primary/80",
  outboundQuoteTextCls: "text-white/60",
  inboundQuoteTextCls: "text-foreground/60",
};

export const CHANNEL_THEMES: Record<string, ChannelTheme> = {
  WHATSAPP: {
    /* Surface: WhatsApp light parchment → dark charcoal #0b141a */
    surfaceCls: "bg-[#e5ddd5] dark:bg-[#0b141a]",
    surfaceStyle: {},

    /* Outbound: light green #dcf8c6 → dark teal #005c4b */
    outboundCls: "bg-[#dcf8c6] shadow-sm dark:bg-[#005c4b] dark:shadow-black/20",
    /* Inbound: white → dark surface #202c33 */
    inboundCls: "bg-white shadow-sm dark:bg-[#202c33] dark:shadow-black/20",

    outboundTailColor: "#dcf8c6",
    inboundTailColor: "#ffffff",

    /* Text: dark gray → white */
    outboundTextCls: "text-[#111827] dark:text-white",
    inboundTextCls: "text-[#111827] dark:text-white",

    /* Links: green → teal-300 */
    outboundLinkCls: "text-[#075e54] underline dark:text-[#53bdeb]",
    inboundLinkCls: "text-[#075e54] underline dark:text-[#53bdeb]",

    /* Inline code */
    outboundCodeCls: "bg-black/[0.06] px-1 py-0.5 rounded font-mono text-[12.5px] text-[#111827] dark:bg-white/10 dark:text-white",
    inboundCodeCls: "bg-black/[0.06] px-1 py-0.5 rounded font-mono text-[12.5px] text-[#111827] dark:bg-white/10 dark:text-white",

    /* Code blocks */
    outboundPreCls: "bg-black/[0.06] p-2 rounded-md font-mono text-[12px] overflow-x-auto my-1 dark:bg-white/10 dark:text-white",
    inboundPreCls: "bg-black/[0.06] p-2 rounded-md font-mono text-[12px] overflow-x-auto my-1 dark:bg-white/10 dark:text-white",

    /* Meta/timestamp */
    outboundMetaCls: "text-[#111827]/45 dark:text-white/40",
    inboundMetaCls: "text-[#111827]/45 dark:text-white/40",

    statusVariant: "dark",

    /* Reply quotes */
    outboundQuoteCls: "border-l-2 border-[#075e54]/30 bg-[#075e54]/[0.08] dark:border-[#53bdeb]/40 dark:bg-[#53bdeb]/[0.1]",
    inboundQuoteCls: "border-l-2 border-[#075e54]/30 bg-[#075e54]/[0.06] dark:border-[#53bdeb]/30 dark:bg-[#53bdeb]/[0.08]",
    outboundQuoteSenderCls: "text-[#075e54]/80 dark:text-[#53bdeb]/80",
    inboundQuoteSenderCls: "text-[#075e54]/80 dark:text-[#53bdeb]/80",
    outboundQuoteTextCls: "text-[#111827]/60 dark:text-white/55",
    inboundQuoteTextCls: "text-[#111827]/60 dark:text-white/55",
  },

  TELEGRAM: {
    /* Surface: light blue #c8d8e4 → dark #0e1621 */
    surfaceCls: "bg-[#c8d8e4] dark:bg-[#0e1621]",
    surfaceStyle: {},

    /* Outbound: light green #effdde → dark blue #2b5278 */
    outboundCls: "bg-[#effdde] shadow-sm dark:bg-[#2b5278] dark:shadow-black/20",
    /* Inbound: white → dark surface #182533 */
    inboundCls: "bg-white shadow-sm dark:bg-[#182533] dark:shadow-black/20",

    outboundTailColor: "#effdde",
    inboundTailColor: "#ffffff",

    /* Text: dark gray → white */
    outboundTextCls: "text-[#111827] dark:text-white",
    inboundTextCls: "text-[#111827] dark:text-white",

    /* Links: blue → Telegram link blue */
    outboundLinkCls: "text-[#2481cc] underline dark:text-[#6ab2f2]",
    inboundLinkCls: "text-[#2481cc] underline dark:text-[#6ab2f2]",

    /* Inline code */
    outboundCodeCls: "bg-black/[0.06] px-1 py-0.5 rounded font-mono text-[12.5px] text-[#111827] dark:bg-white/10 dark:text-white",
    inboundCodeCls: "bg-black/[0.06] px-1 py-0.5 rounded font-mono text-[12.5px] text-[#111827] dark:bg-white/10 dark:text-white",

    /* Code blocks */
    outboundPreCls: "bg-black/[0.06] p-2 rounded-md font-mono text-[12px] overflow-x-auto my-1 dark:bg-white/10 dark:text-white",
    inboundPreCls: "bg-black/[0.06] p-2 rounded-md font-mono text-[12px] overflow-x-auto my-1 dark:bg-white/10 dark:text-white",

    /* Meta/timestamp */
    outboundMetaCls: "text-[#111827]/45 dark:text-white/40",
    inboundMetaCls: "text-[#111827]/45 dark:text-white/40",

    statusVariant: "dark",

    /* Reply quotes */
    outboundQuoteCls: "border-l-2 border-[#2481cc]/30 bg-[#2481cc]/[0.08] dark:border-[#6ab2f2]/40 dark:bg-[#6ab2f2]/[0.1]",
    inboundQuoteCls: "border-l-2 border-[#2481cc]/30 bg-[#2481cc]/[0.06] dark:border-[#6ab2f2]/30 dark:bg-[#6ab2f2]/[0.08]",
    outboundQuoteSenderCls: "text-[#2481cc]/80 dark:text-[#6ab2f2]/80",
    inboundQuoteSenderCls: "text-[#2481cc]/80 dark:text-[#6ab2f2]/80",
    outboundQuoteTextCls: "text-[#111827]/60 dark:text-white/55",
    inboundQuoteTextCls: "text-[#111827]/60 dark:text-white/55",
  },
};

export function getChannelTheme(provider?: string | null): ChannelTheme {
  if (!provider) return DEFAULT_THEME;
  return CHANNEL_THEMES[provider.toUpperCase()] ?? DEFAULT_THEME;
}
