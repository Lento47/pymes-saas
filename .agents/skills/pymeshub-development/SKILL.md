---
name: pymeshub-development
description: Implement PymesHub web and API features using the repository's actual auth, routing, permissions, and design contracts. Use for changes within this monorepo.
---

# PymesHub development

Read repository AGENTS.md and the files affected by the change. Follow the root pnpm workspace; inspect package.json for current versions and scripts.

- Web: apps/web/client/src; React, wouter, Tailwind, Radix primitives, TanStack Query. Reuse existing components when their interaction model fits the requested design.
- API calls: apps/web/client/src/lib/api.ts. Trace the corresponding NestJS controller/service before changing payload validation or security behavior.
- Auth: hooks/use-auth.ts owns a shared in-memory user. Use refreshUser after profile changes; invalidating a query alone does not refresh this store.
- Routing: verify App.tsx and hooks/use-workspace-location.ts. Use pathname links through wouter, preserving workspace routing.
- Permissions: lib/permissions.ts controls presentation; backend guards remain authoritative. Distinguish feature availability, user permissions, and local display preferences.
- Styling: consult repository DESIGN.md for the current product direction. The user's requested mobile redesign supersedes old visual conventions. Keep marketing and authenticated app styling scoped separately.
- No production mock data. Provide honest loading, empty, denied, error, and retry states for real API calls.
- Before DB changes, inspect Prisma schema and migrations. Before edge changes, load the relevant Cloudflare skill. Neither is required for ordinary frontend changes.

Verification: pnpm --filter rest-express check, pnpm --filter rest-express test, pnpm --filter rest-express build. Inspect scripts and test coverage before selecting checks; a green build does not prove authorization or accessibility.

Incident constraints from AGENTS.md: preserve WhatsApp service methods, conversation cache bypasses and polling; avoid speculative API/type names and broad code deletion. Inspect any referenced pre-push script before running it; do not invent missing scripts.
