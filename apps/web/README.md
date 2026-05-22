# PymesHub Web

Frontend de la plataforma SaaS PymesHub. SPA React con SSR mínimo vía Express.

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite 7 |
| UI | Tailwind CSS 3 + Radix UI |
| Routing | Wouter |
| Data Fetching | TanStack React Query |
| WebSocket | Socket.io Client |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Animations | Framer Motion |
| Tests | Vitest + React Testing Library |

## Arranque rápido

```bash
cd apps/web

# Instalar dependencias
pnpm install

# Desarrollo (http://localhost:5000)
pnpm dev

# Build de producción
pnpm build

# Lint + type check
pnpm lint
pnpm check

# Tests
pnpm test
pnpm test:watch
```

## Estructura

```
apps/web/
├── client/src/
│   ├── main.tsx              # Entry point + ReactDOM.render
│   ├── App.tsx               # Router + auth guard + layout
│   ├── index.css             # Tailwind + global styles
│   ├── pages/                # Page components (routing targets)
│   │   ├── login.tsx         # Login + SSO
│   │   ├── register.tsx      # Registro público
│   │   ├── dashboard.tsx     # Dashboard principal
│   │   ├── inbox.tsx         # Bandeja de conversaciones
│   │   ├── conversation.tsx  # Chat individual
│   │   ├── contacts.tsx      # CRM contactos
│   │   ├── invoices.tsx      # Facturación electrónica
│   │   ├── pipeline.tsx      # Pipeline de ventas
│   │   ├── settings.tsx      # Configuración workspace
│   │   ├── billing.tsx       # Planes y facturación
│   │   └── ...               # +20 páginas más
│   ├── components/
│   │   ├── layout/           # Sidebar, header, shell
│   │   ├── ui/               # Componentes base (shadcn-style)
│   │   └── shared/           # Componentes compartidos
│   ├── hooks/                # Custom hooks
│   │   ├── use-auth.ts       # Auth state + session
│   │   ├── use-socket.ts     # WebSocket singleton
│   │   ├── use-inbox-socket.ts
│   │   └── use-conversation-socket.ts
│   ├── lib/
│   │   ├── api.ts            # API client + auth state
│   │   ├── queryClient.ts    # TanStack Query config
│   │   └── error-reporting.ts
│   └── features/             # Feature-specific code colocation
│       └── inbox/            # Inbox feature components
├── server/                   # Express SSR server
│   ├── index.ts
│   └── routes.ts
├── vite.config.ts            # Vite + Vitest config
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## WebSocket

La app mantiene una conexión WebSocket singleton con el backend para mensajes en tiempo real:

- **Conexión:** Socket.io sobre `/socket.io` → namespace `/ws`
- **DEV:** `localhost:4000`
- **PROD:** `VITE_WS_URL` (directo a Railway, evita Cloudflare Workers)
- **Reconexión:** Backoff exponencial infinito (1s → 30s max, con jitter)
- **Eventos:** `message:new`, `message:media-ready`, `conversation:updated`

## Scripts

```bash
pnpm dev            # Dev server (localhost:5000)
pnpm build          # Build para producción
pnpm start          # Producción
pnpm check          # TypeScript type-check
pnpm lint           # ESLint
pnpm format         # Prettier
pnpm test           # Vitest (unitarios)
pnpm test:watch     # Vitest watch mode
```

## Testing

```bash
# Todos los tests
pnpm test

# Watch mode
pnpm test:watch

# Archivo específico
npx vitest run src/lib/api.test.ts
```

Tests actuales: API client (auth state, ApiError formatting).

## Workflow de ramas

- `main-web` → rama de features/fixes → PR → merge → delete branch
