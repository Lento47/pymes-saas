import type React from "react";

export interface ChannelTheme {
  // Chat surface
  surfaceCls: string;
  surfaceStyle: React.CSSProperties;

  // Bubble backgrounds (include text color)
  outboundCls: string;
  inboundCls: string;

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

  // Status icon colors (outbound only)
  statusDimCls: string;
  statusReadCls: string;

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

  statusDimCls: "text-white/70",
  statusReadCls: "text-sky-300",

  outboundQuoteCls: "border-l-2 border-white/40 bg-white/10",
  inboundQuoteCls: "border-l-2 border-primary/50 bg-primary/[0.06]",
  outboundQuoteSenderCls: "text-white/70",
  inboundQuoteSenderCls: "text-primary/80",
  outboundQuoteTextCls: "text-white/60",
  inboundQuoteTextCls: "text-foreground/60",
};

export const CHANNEL_THEMES: Record<string, ChannelTheme> = {
  WHATSAPP: {
    /* Surface: CSS vars — dark default in :root, light override in html.light (index.css) */
    surfaceCls: "bg-[var(--wa-surface)]",
    surfaceStyle: {},

    outboundCls: "bg-[var(--wa-bubble-out)] shadow-sm",
    inboundCls: "bg-[var(--wa-bubble-in)] shadow-sm",

    outboundTextCls: "text-[var(--wa-text)]",
    inboundTextCls: "text-[var(--wa-text)]",

    outboundLinkCls: "text-[var(--wa-link)] underline",
    inboundLinkCls: "text-[var(--wa-link)] underline",

    outboundCodeCls: "bg-[var(--wa-code-bg)] px-1 py-0.5 rounded font-mono text-[12.5px] text-[var(--wa-text)]",
    inboundCodeCls: "bg-[var(--wa-code-bg)] px-1 py-0.5 rounded font-mono text-[12.5px] text-[var(--wa-text)]",

    outboundPreCls: "bg-[var(--wa-code-bg)] p-2 rounded-md font-mono text-[12px] overflow-x-auto my-1 text-[var(--wa-text)]",
    inboundPreCls: "bg-[var(--wa-code-bg)] p-2 rounded-md font-mono text-[12px] overflow-x-auto my-1 text-[var(--wa-text)]",

    outboundMetaCls: "text-[var(--wa-meta)]",
    inboundMetaCls: "text-[var(--wa-meta)]",

    statusDimCls: "text-[var(--wa-meta)]",
    statusReadCls: "text-[var(--wa-status-read)]",

    outboundQuoteCls: "border-l-2 border-[var(--wa-quote-border)] bg-[var(--wa-quote-bg)]",
    inboundQuoteCls: "border-l-2 border-[var(--wa-quote-border)] bg-[var(--wa-quote-bg)]",
    outboundQuoteSenderCls: "text-[var(--wa-quote-sender)]",
    inboundQuoteSenderCls: "text-[var(--wa-quote-sender)]",
    outboundQuoteTextCls: "text-[var(--wa-quote-text)]",
    inboundQuoteTextCls: "text-[var(--wa-quote-text)]",
  },

  TELEGRAM: {
    /* Surface: CSS vars — dark default in :root, light override in html.light (index.css) */
    surfaceCls: "bg-[var(--tg-surface)]",
    surfaceStyle: {},

    outboundCls: "bg-[var(--tg-bubble-out)] shadow-sm",
    inboundCls: "bg-[var(--tg-bubble-in)] shadow-sm",

    outboundTextCls: "text-[var(--tg-text)]",
    inboundTextCls: "text-[var(--tg-text)]",

    outboundLinkCls: "text-[var(--tg-link)] underline",
    inboundLinkCls: "text-[var(--tg-link)] underline",

    outboundCodeCls: "bg-[var(--tg-code-bg)] px-1 py-0.5 rounded font-mono text-[12.5px] text-[var(--tg-text)]",
    inboundCodeCls: "bg-[var(--tg-code-bg)] px-1 py-0.5 rounded font-mono text-[12.5px] text-[var(--tg-text)]",

    outboundPreCls: "bg-[var(--tg-code-bg)] p-2 rounded-md font-mono text-[12px] overflow-x-auto my-1 text-[var(--tg-text)]",
    inboundPreCls: "bg-[var(--tg-code-bg)] p-2 rounded-md font-mono text-[12px] overflow-x-auto my-1 text-[var(--tg-text)]",

    outboundMetaCls: "text-[var(--tg-meta)]",
    inboundMetaCls: "text-[var(--tg-meta)]",

    statusDimCls: "text-[var(--tg-meta)]",
    statusReadCls: "text-[var(--tg-status-read)]",

    outboundQuoteCls: "border-l-2 border-[var(--tg-quote-border)] bg-[var(--tg-quote-bg)]",
    inboundQuoteCls: "border-l-2 border-[var(--tg-quote-border)] bg-[var(--tg-quote-bg)]",
    outboundQuoteSenderCls: "text-[var(--tg-quote-sender)]",
    inboundQuoteSenderCls: "text-[var(--tg-quote-sender)]",
    outboundQuoteTextCls: "text-[var(--tg-quote-text)]",
    inboundQuoteTextCls: "text-[var(--tg-quote-text)]",
  },
};

export function getChannelTheme(provider?: string | null): ChannelTheme {
  if (!provider) return DEFAULT_THEME;
  return CHANNEL_THEMES[provider.toUpperCase()] ?? DEFAULT_THEME;
}
