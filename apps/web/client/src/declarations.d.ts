// Ambient declarations for packages that lack bundled TypeScript types
// or need import path support. Do NOT declare modules that ship their own .d.ts.

// ── Raw file imports (Vite `?raw` suffix) ────────────────────────────────────
declare module "*.md?raw" { const content: string; export default content; }
declare module "*.txt?raw" { const content: string; export default content; }

// ── Asset imports ─────────────────────────────────────────────────────────────
declare module "*.png" { const src: string; export default src; }
declare module "*.jpg" { const src: string; export default src; }
declare module "*.svg" { const src: string; export default src; }
declare module "*.webp" { const src: string; export default src; }
declare module "*.gif" { const src: string; export default src; }

// ── Packages without bundled types ────────────────────────────────────────────
declare module "embla-carousel";
declare module "sonner";
declare module "helmet";
declare module "http-proxy-middleware";
declare module "vitest/config";
declare module "@vitejs/plugin-react";
declare module "passport";
declare module "passport-local";
declare module "connect-pg-simple";
declare module "@tanstack/react-query-devtools";
declare module "react-zoom-pan-pinch";
declare module "remark-gfm";
