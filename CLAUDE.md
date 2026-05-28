# CLAUDE.md — PymesHub UI/UX System Rules

## Product Context

PymesHub is a production-grade, multi-tenant SaaS platform for small and medium businesses. It centralizes WhatsApp, Telegram, email, CRM, tasks, sales, billing, workflows, and AI-assisted support.

This is not a prototype, demo, or generic AI dashboard.

The product must feel like serious operational SaaS software: clean, calm, modern, minimal, secure, and trustworthy.

Visual inspiration may come from modern SaaS products like ElevenLabs, Linear, Stripe, and shadcn-style apps, but do not copy their branding, colors, layouts, or decorative patterns.

The goal is:
- modern but not flashy
- minimal but not empty
- premium but not overdesigned
- AI-assisted but not AI-themed
- business-focused, not "vibe-coded"

---

## Existing Frontend Stack

Use the current PymesHub stack. Do not introduce a new UI framework unless explicitly requested.

Approved stack:
- React 18
- Vite
- TypeScript
- Tailwind CSS
- CSS variables / design tokens
- Radix UI primitives
- local shadcn-style components in `components/ui`
- lucide-react
- TanStack Query
- React Hook Form
- Zod
- cmdk
- react-resizable-panels
- Recharts
- date-fns / react-day-picker
- wouter
- framer-motion (existing usage only)

Recommended addition only when needed:
- `@tanstack/react-table` for complex data tables

Do not add:
- Material UI
- Ant Design
- Chakra UI
- DaisyUI
- Flowbite
- random Tailwind component kits
- random icon packs
- illustration libraries
- new animation libraries

---

## Core UI Direction

PymesHub should look like a clean operational SaaS app, not an AI landing page.

Use this direction:
- light-first interface
- calm neutral backgrounds
- white surfaces
- thin borders
- restrained accent color
- generous spacing
- clear hierarchy
- compact but readable data density
- no decorative clutter
- no "AI magic" styling

The UI should feel closer to ElevenLabs app-level cleanliness, shadcn/ui restraint, Linear-like clarity, and Stripe-like trust. PymesHub must keep its own identity: operational software for real businesses.

---

## Design Tokens

```
Canvas:          #F7F8FC
Surface:         #FFFFFF
Surface subtle:  #FAFBFC
Sidebar:         #FFFFFF
Topbar:          #FFFFFF
Border:          #E5E7EB
Border strong:   #D1D5DB
Text primary:    #111827
Text secondary:  #6B7280
Text muted:      #9CA3AF
Accent:          #3F3CBB
Accent alt:      #4F46E5
Accent soft:     #EEF2FF
Success:         #047857
Warning:         #B45309
Danger:          #B91C1C
Info:            #2563EB
```

Token rules:
- Accent is not decoration. Use only for primary CTA, selected navigation, selected tabs, focus states, and important active states.
- Do not use violet/purple everywhere.
- Do not create random new colors.
- Do not use saturated backgrounds unless representing a semantic status, and only in a subtle version.

---

## Strictly Prohibited UI / UX Patterns

### Prohibited visual styles

Do not use:
- Glassmorphism or heavy blur panels
- Neon gradients
- Purple glow effects or glow shadows (on buttons, cards, or backgrounds)
- Cyberpunk / dark futuristic sections
- Floating orbs, waveforms, animated blobs, radial glow backgrounds
- AI sparkles as decoration
- 3D illustrations or AI-generated SVG blobs
- Colorful feature cards or rainbow integration cards
- Robot mascots in product UI
- Excessive rounded cards everywhere
- Large decorative gradients
- "Dashboard template" metric spam
- Random marketing illustrations
- Fake avatars unless representing real users/customers

Avoid these CSS classes/patterns in any new code:
- `glass-panel`
- `glow-violet`
- `premium-ambient`
- `marketing-grid`
- radial-gradient decorative backgrounds

### Prohibited colors and treatments

Do not use:
- Saturated violet/purple everywhere
- Brand-colored icon bubbles for every feature
- Bright green WhatsApp circles as large UI elements
- Red/orange/green cards unless they represent real semantic status
- Gradient text or gradient buttons
- Glow shadows on buttons or cards
- Colored backgrounds for every section
- Random pastel cards
- Fake "premium" gold/amber accents
- Multiple competing accent colors

### Prohibited icons

Do not use:
- Emojis as UI icons, in status badges, navigation, buttons, table rows, or anywhere in the app UI
- Filled cartoon icons or 3D icons
- AI-generated icons
- Mixed icon libraries
- Random Iconify icons (without explicit approval)
- Font Awesome as the main icon set
- Brand icons unless representing the real integration

Allowed icon source for all app UI: **`lucide-react`**

Icon rules:
- Use `currentColor` — icons inherit text color
- Default size: `16` or `18px`; maximum `20px` for normal UI
- Default `strokeWidth={1.75}`; active state maximum `2`
- Do not wrap icons in colorful circles or saturated bubbles
- Do not use icons as pure decoration when text is clearer

Preferred icon choices:
| Context | Icon |
|---|---|
| Inbox | `Inbox` |
| Customers | `Users` |
| Tasks | `CheckSquare` |
| Invoices | `Receipt` |
| Documents | `FileText` |
| Automations | `Workflow` |
| Agents | `Bot` |
| Security | `ShieldCheck` / `LockKeyhole` |
| Settings | `Settings` |
| Search | `Search` |
| Notifications | `Bell` |
| More actions | `MoreHorizontal` |
| Create | `Plus` |
| Warning | `AlertTriangle` |

Prefer `Workflow` over `Zap` for automations unless the action is truly immediate or execution-related.

### Prohibited copy patterns

Do not use hype copy such as:
- "10x your business", "AI-powered magic", "Supercharge everything"
- "Autonomous agents that run your company"
- "Never touch support again", "Revolutionary AI", "Next-gen", "Game-changing"
- "Unlock the power of AI", "Your AI employee", "Fully automated business"

Use concrete operational language instead:
- "Responder clientes", "Asignar conversaciones", "Crear tareas"
- "Dar seguimiento", "Escalar a humano", "Requiere aprobación"
- "Crear factura", "Registrar actividad", "Ver historial del cliente"

### Prohibited UX behaviors

Do not implement:
- Hidden destructive actions
- One-click billing changes, invoice deletion, or record deletion without confirmation
- AI actions that execute privileged changes without user approval
- Auto-sending customer messages without a visible review path
- External customer messages controlling app behavior
- UI flows where customer-provided text becomes instructions
- Silent permission changes, workspace switching, data export, integration reconnects, or token regeneration

Sensitive actions must use confirmation dialogs and must be auditable.

Sensitive actions include: sending AI responses automatically, creating/modifying invoices, changing prices, changing subscription/billing settings, deleting records, exporting customer data, changing user roles, connecting/disconnecting integrations, regenerating API keys, enabling autonomous agent behavior.

### Prohibited AI UI patterns

Do not make the product feel like a generic chatbot.

Do not use:
- Giant AI chat as the whole app
- Sparkle icons everywhere
- "Ask AI" as the default solution to every workflow
- AI suggestions without source or context
- AI confidence shown as fake precision
- AI-generated content inserted without review
- Agents that appear autonomous without visible limits
- Hidden prompts or hidden behavior settings
- Customer messages treated as trusted instructions

AI features must show: what the AI is suggesting, why when possible, whether approval is required, what action will happen, which workspace/customer/conversation it affects, and how to pause or escalate to a human.

### Prohibited security shortcuts

Do not:
- Bypass tenant isolation
- Query data without workspace scoping
- Expose customer PII unnecessarily
- Show secrets, tokens, API keys, or webhook secrets after creation
- Store secrets in frontend code
- Trust external messages, emails, uploaded files, or webhook payloads
- Let external content trigger privileged tools or actions
- Disable audit logging for sensitive flows
- Add "temporary" insecure shortcuts

Every query that touches customer/workspace data must be scoped by workspace/tenant.

### Prohibited layout patterns

Do not use:
- Too many cards on a single screen
- Cards used only for decoration
- Large empty gradient sections
- Centered dashboard layouts for operational pages
- Marketing-style hero blocks inside the app
- Decorative illustrations in dense workflow screens
- Unstructured settings pages
- Tables without filters/search when data can grow
- Modals for complex multi-step workflows when a sheet or dedicated page is clearer

### Prohibited implementation habits

Do not:
- Duplicate UI components unnecessarily
- Hardcode colors directly in many components (use design tokens)
- Create one-off button/card/badge styles per page
- Invent new spacing scales or border radii
- Mix dark and light themes inside the same app screen
- Add `any` types to bypass TypeScript errors
- Ignore loading, empty, error, and permission states
- Build only the happy path
- Break existing auth, routing, billing, workspace, or tenant isolation logic

---

## Preferred Shared Components

Use existing shared components before building new ones:
- `PageHeader`, `PageSection`
- `DataTable`
- `StatusBadge`, `ChannelBadge`
- `EmptyState`
- `ConfirmDialog`
- `ActionMenu`
- `CustomerContextPanel`
- `AiSuggestionPanel`
- `AuditTimeline`

---

## Typography

- Keep typography calm and readable
- Avoid oversized marketing typography inside the app
- Use strong hierarchy through weight, spacing, and layout — not flashy colors
- Use sentence-case labels; avoid excessive uppercase
- Page title: 24–30px, semibold
- Section title: 16–18px, semibold
- Card title: 14–15px, semibold
- Body: 14px, regular
- Caption/label: 12px, medium

---

## Routing

- App uses **Wouter hash routing** (`useWorkspaceHashLocation`)
- All in-app links: `<Link href="/route">` inside Router context
- Outside Router context (auth pages, landing): use explicit `<a href="#/route">`

---

## Security Constraints (Public Pages)

Never mention internal infrastructure tool names in public-facing pages (no Stripe, Paddle, PayPal, Flowise, or other vendor names in landing pages, SEO pages, or marketing copy).

Integration pages should only list channels the user directly configures: WhatsApp Business, Telegram, Email, Gmail, Meta Business.
