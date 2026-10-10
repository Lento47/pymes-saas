# Home fold backup — pre-editorial

Snapshot taken 2026-10-09, before the editorial home header from
`# PYMESHUB — EXACT EDITORIAL HOME.md`.

Filenames use `__` instead of path separators.

| File | Restore to |
|---|---|
| `app__(customer)__index.tsx` | `app/(customer)/index.tsx` |
| `components__home-header.tsx` | `components/home-header.tsx` |
| `components__hero-search.tsx` | `components/hero-search.tsx` |
| `components__home-gradient.tsx` | `components/home-gradient.tsx` |
| `components__band-geometry.tsx` | `components/band-geometry.tsx` |
| `components__skeletons.tsx` | `components/skeletons.tsx` |
| `lib__home-discovery.snapshot.ts` | `lib/home-discovery.test.ts` |
| `lib__home-gradient.snapshot.ts` | `lib/home-gradient.test.ts` |

Copy a file back over its live path to restore that piece of the previous fold.
The archived tests use `.snapshot.ts` so Bun does not run them in this folder.
