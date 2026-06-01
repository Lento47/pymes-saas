import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        panel: "20px",
        card: "16px",
        control: "12px",
        xl2: "24px",
      },
      colors: {
        background:  "hsl(var(--bg) / <alpha-value>)",
        foreground:  "hsl(var(--fg) / <alpha-value>)",
        border:      "hsl(var(--border) / <alpha-value>)",
        elevated:    "hsl(var(--bg-elevated) / <alpha-value>)",
        "bg-hover":  "hsl(var(--bg-hover) / <alpha-value>)",
        input:       "hsl(var(--border) / <alpha-value>)",
        ring:        "hsl(var(--accent) / <alpha-value>)",
        brand: {
          indigo: "#5B5CF0",
          violet: "#7C3AED",
          blue: "#3B82F6",
        },
        "primary-border":     "hsl(var(--accent) / 0.25)",
        "destructive-border": "hsl(var(--danger) / 0.25)",
        "secondary-border":   "hsl(var(--border) / <alpha-value>)",
        card: {
          DEFAULT:    "hsl(var(--bg-card) / <alpha-value>)",
          foreground: "hsl(var(--fg) / <alpha-value>)",
        },
        popover: {
          DEFAULT:    "hsl(var(--bg-elevated) / <alpha-value>)",
          foreground: "hsl(var(--fg) / <alpha-value>)",
        },
        primary: {
          DEFAULT:    "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-fg) / <alpha-value>)",
        },
        secondary: {
          DEFAULT:    "hsl(var(--bg-card) / <alpha-value>)",
          foreground: "hsl(var(--fg) / <alpha-value>)",
        },
        muted: {
          DEFAULT:    "hsl(var(--bg-card) / <alpha-value>)",
          foreground: "hsl(var(--fg-2) / <alpha-value>)",
        },
        accent: {
          DEFAULT:    "hsl(var(--bg-card) / <alpha-value>)",
          foreground: "hsl(var(--fg) / <alpha-value>)",
        },
        destructive: {
          DEFAULT:    "hsl(var(--danger) / <alpha-value>)",
          foreground: "hsl(var(--danger-fg) / <alpha-value>)",
        },
        sidebar: {
          DEFAULT:    "hsl(var(--bg-sidebar) / <alpha-value>)",
          foreground: "hsl(var(--fg) / <alpha-value>)",
          border:     "hsl(var(--border) / <alpha-value>)",
          ring:       "hsl(var(--accent) / <alpha-value>)",
          primary: {
            DEFAULT:    "hsl(var(--accent) / <alpha-value>)",
            foreground: "hsl(var(--accent-fg) / <alpha-value>)",
          },
          accent: {
            DEFAULT:    "hsl(var(--bg-active) / <alpha-value>)",
            foreground: "hsl(var(--fg) / <alpha-value>)",
          },
        },
        success: {
            DEFAULT: "hsl(var(--success) / <alpha-value>)",
            foreground: "hsl(0 0% 100% / <alpha-value>)",
          },
          warning: {
            DEFAULT: "hsl(var(--warning) / <alpha-value>)",
            foreground: "hsl(0 0% 100% / <alpha-value>)",
          },
          info: {
            DEFAULT: "hsl(var(--info) / <alpha-value>)",
            foreground: "hsl(var(--info-fg) / <alpha-value>)",
          },
          chart: {
            "1": "hsl(var(--accent) / <alpha-value>)",
            "2": "hsl(var(--success) / <alpha-value>)",
            "3": "hsl(var(--warning) / <alpha-value>)",
            "4": "hsl(262 60% 62% / <alpha-value>)",
            "5": "hsl(var(--danger) / <alpha-value>)",
          },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      fontSize: {
        "2xs": ["11px", "1.4"],
        xs:    ["12px", "1.5"],
        sm:    ["13px", "1.5"],
        base:  ["14px", "1.5"],
        lg:    ["15px", "1.4"],
        xl:    ["17px", "1.3"],
        "2xl": ["20px", "1.25"],
        "3xl": ["24px", "1.2"],
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up":   { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.15s ease-out",
        "accordion-up":   "accordion-up 0.15s ease-out",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.08)",
        panel: "0 18px 60px rgba(0,0,0,0.36), 0 0 0 1px rgba(139,92,246,0.08)",
        glow: "0 0 40px rgba(139,92,246,0.32), 0 0 12px rgba(139,92,246,0.18)",
        "glow-sm": "0 0 20px rgba(139,92,246,0.25), 0 0 6px rgba(139,92,246,0.14)",
        "premium": "0 24px 80px rgba(0,0,0,0.40), 0 0 0 1px rgba(139,92,246,0.12), 0 0 40px rgba(139,92,246,0.08)",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
