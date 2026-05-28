# PymesHub — Project Context for Claude Code

## Design System

### Component sources (approved only)
- **Radix UI primitives** — behavior and accessibility
- **shadcn/ui** — base React/Tailwind components
- **lucide-react** — primary icon library (outline, size 16/18/20, strokeWidth 1.75–2, `currentColor`)
- **@tabler/icons-react** — only when Lucide has no appropriate business equivalent

### Never use
- Emojis as UI status indicators
- AI-generated SVGs or illustration packs
- 3D icons, colorful icon bubbles
- Glassmorphism (`glass-panel`, `backdrop-blur` decoratively)
- Neon gradients or glow effects (`glow-violet`, `premium-ambient`, `marketing-grid`)
- Iconify (without explicit approval)
- Font Awesome as the main app icon system

### Icon rules
- Outline style only
- Size 16 / 18 / 20 px
- Stroke width 1.75 or 2
- Always use `currentColor` — icons inherit text color
- No assigned brand colors on icons except small channel-indicator dots when strictly necessary

### Color palette
| Token | Value | Use |
|---|---|---|
| Canvas | `#F7F8FC` | Page/section backgrounds |
| Surface | `#FFFFFF` | Cards, panels |
| Ink | `#111827` | Primary text |
| Muted | `#6B7280` | Secondary text, labels |
| Border | `#E5E7EB` | Card borders, dividers |
| Accent | `#4F46E5` (or `#3F3CBB`) | CTAs, active states, links |

- **One accent color only** — do not introduce additional brand colors
- No decorative gradients on surfaces
- No purple glow box-shadows
- No colored icon-bubble backgrounds (use `bg-gray-100 text-gray-500`)

### Component rules
- White (`#FFFFFF`) surfaces on `#F7F8FC` canvas
- Borders: `border border-[#E5E7EB]` or `border-[#E6E8EF]`
- Rounded corners: `rounded-xl` / `rounded-2xl` (no `rounded-[32px]` decorative shapes)
- Keep card density low — prefer fewer, larger cards over excessive card grids
- No excessive nesting or decorative wrappers

## Security constraints
- **Never mention internal infrastructure tools in public-facing pages** (no Stripe, Paddle, PayPal, Flowise, or other vendor names in landing pages, SEO pages, or marketing copy)
- Integration pages should only list channels the user directly configures (WhatsApp, Telegram, Email, Gmail, Meta Business)

## Routing
- App uses **Wouter hash routing** (`useWorkspaceHashLocation`)
- All in-app links: `<Link href="/route">` inside Router context
- Outside Router context (auth pages, landing): use explicit `<a href="#/route">`

## Tech stack
- Frontend: React + TypeScript + Tailwind CSS (Vite)
- Backend: NestJS + Prisma + PostgreSQL
- Monorepo: `apps/web` (frontend) · `apps/api` (backend)
- Branch strategy: squash-merge PRs into `master`
