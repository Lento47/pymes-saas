import type React from "react";

export interface ChannelTheme {
  // Chat surface
  surfaceCls: string;
  surfaceStyle: React.CSSProperties;

  // Bubble backgrounds (include text color)
  outboundCls: string;
  inboundCls: string;

  // SVG tail fill (inline CSS color string)
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

const DEFAULT_SURFACE_STYLE: React.CSSProperties = {
  backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.045) 1px, transparent 1px)`,
  backgroundSize: `20px 20px`,
};

export const DEFAULT_THEME: ChannelTheme = {
  surfaceCls: "bg-muted/[0.12]",
  surfaceStyle: DEFAULT_SURFACE_STYLE,

  outboundCls: "bg-primary text-primary-foreground shadow-[0_1px_3px_rgba(79,70,229,0.18)]",
  inboundCls: "bg-card border border-border/40 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",

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
    surfaceCls: "bg-[#e5ddd5]",
    surfaceStyle: {},

    outboundCls: "bg-[#dcf8c6] shadow-sm",
    inboundCls: "bg-white shadow-sm",

    outboundTailColor: "#dcf8c6",
    inboundTailColor: "#ffffff",

    outboundTextCls: "text-[#111827]",
    inboundTextCls: "text-[#111827]",

    outboundLinkCls: "text-[#075e54] underline",
    inboundLinkCls: "text-[#075e54] underline",

    outboundCodeCls: "bg-black/[0.06] px-1 py-0.5 rounded font-mono text-[12.5px] text-[#111827]",
    inboundCodeCls: "bg-black/[0.06] px-1 py-0.5 rounded font-mono text-[12.5px] text-[#111827]",

    outboundPreCls: "bg-black/[0.06] p-2 rounded-md font-mono text-[12px] overflow-x-auto my-1",
    inboundPreCls: "bg-black/[0.06] p-2 rounded-md font-mono text-[12px] overflow-x-auto my-1",

    outboundMetaCls: "text-[#111827]/45",
    inboundMetaCls: "text-[#111827]/45",

    statusVariant: "dark",

    outboundQuoteCls: "border-l-2 border-[#075e54]/30 bg-[#075e54]/[0.08]",
    inboundQuoteCls: "border-l-2 border-[#075e54]/30 bg-[#075e54]/[0.06]",
    outboundQuoteSenderCls: "text-[#075e54]/80",
    inboundQuoteSenderCls: "text-[#075e54]/80",
    outboundQuoteTextCls: "text-[#111827]/60",
    inboundQuoteTextCls: "text-[#111827]/60",
  },

  TELEGRAM: {
    surfaceCls: "bg-[#c8d8e4]",
    surfaceStyle: {},

    outboundCls: "bg-[#effdde] shadow-sm",
    inboundCls: "bg-white shadow-sm",

    outboundTailColor: "#effdde",
    inboundTailColor: "#ffffff",

    outboundTextCls: "text-[#111827]",
    inboundTextCls: "text-[#111827]",

    outboundLinkCls: "text-[#2481cc] underline",
    inboundLinkCls: "text-[#2481cc] underline",

    outboundCodeCls: "bg-black/[0.06] px-1 py-0.5 rounded font-mono text-[12.5px] text-[#111827]",
    inboundCodeCls: "bg-black/[0.06] px-1 py-0.5 rounded font-mono text-[12.5px] text-[#111827]",

    outboundPreCls: "bg-black/[0.06] p-2 rounded-md font-mono text-[12px] overflow-x-auto my-1",
    inboundPreCls: "bg-black/[0.06] p-2 rounded-md font-mono text-[12px] overflow-x-auto my-1",

    outboundMetaCls: "text-[#111827]/45",
    inboundMetaCls: "text-[#111827]/45",

    statusVariant: "dark",

    outboundQuoteCls: "border-l-2 border-[#2481cc]/30 bg-[#2481cc]/[0.08]",
    inboundQuoteCls: "border-l-2 border-[#2481cc]/30 bg-[#2481cc]/[0.06]",
    outboundQuoteSenderCls: "text-[#2481cc]/80",
    inboundQuoteSenderCls: "text-[#2481cc]/80",
    outboundQuoteTextCls: "text-[#111827]/60",
    inboundQuoteTextCls: "text-[#111827]/60",
  },
};

export function getChannelTheme(provider?: string | null): ChannelTheme {
  if (!provider) return DEFAULT_THEME;
  return CHANNEL_THEMES[provider.toUpperCase()] ?? DEFAULT_THEME;
}
