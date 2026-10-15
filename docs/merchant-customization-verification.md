# Merchant customization verification

Status: implementation published; native acceptance is incomplete. Updated 2026-10-15.

## Confirmed evidence

| Requirement | Evidence |
| --- | --- |
| User/business isolation, staff personal preferences, owner/manager shop editing, stale-write rejection | `packages/trpc-api/test/customization.test.ts` |
| Private drafts, publish/discard/default behavior, private photo edits and atomic photo publishing | Same API tests: 5 pass after `15bf2ca2`; injected publish failure rolls photos back |
| Compatibility, Simple presets, operational widgets fixed and visible, readable accent suggestions | `packages/shared/src/schemas/customization.test.ts`: 15 pass |
| Mobile regression coverage | Full mobile suite: 371 pass at `15bf2ca2` |
| Discard unsaved changes and prevent overlapping save/publish/discard actions | Mobile TypeScript and 14 focused customization UI checks pass |
| Type safety | Mobile, shared, API and DB typechecks pass after photo consolidation |
| Deployment | Production API version `d94fcd94-8c76-43eb-b782-ae4c53c7cdb2`; `/health` returned 200 with DB healthy |
| Normal-size Spanish rendering | Merchant dashboard editor, shop header/preview, and compact weekday selector inspected on `emulator-5554` |
| Public small-screen rendering | Published photos and compact hours inspected at 720×1280 with 200% text, Spanish/light and English/dark on the spare emulator |
| Home business card | Photo and details now share one clipped surface and press target; joined layout inspected in English/dark on the spare emulator |
| Cover header readability and brand decoration | Identity now has an opaque theme canvas and grows with text. Full-width stripe replaced by a short rounded gradient above the name; same component in the preview. Inspected in Spanish/light at normal and 200% text on 720×1280 |

Photo controls now live only in Personalization → Customer shop. Uploaded asset paths use the app's image resolver. Photo changes remain private until Publish; settings forms no longer send stale image values.

## Remaining native acceptance

- [ ] Select, crop, remove and preview logo/banner; save a draft, restart, publish, then confirm the customer view.
- [ ] Confirm saved preferences synchronize between two actual app sessions. API tests already verify separate authenticated callers.
- [ ] Check the final editors in both color schemes and languages, on a small screen with 200% text.
- [ ] Recheck the revised cover header in dark mode at 200% text. Spanish/light rendering now keeps all title lines on the opaque canvas.
- [ ] Check TalkBack focus/actions and reduced motion, including fixed operational widgets.
- [ ] Confirm orders remain reachable with optional dashboard widgets hidden and reordered.
- [ ] Confirm product browsing, search, cart, reviews and checkout remain reachable with both shop headers and all optional sections hidden/reordered.

`emulator-5554` is used interactively by the user. The spare `emulator-5556` (`pymeshub-map-verification`) now has the same existing APK, installed with `adb install -r` to retain data; no APK was generated. Its Metro connection was restored, and its display was returned to 720×1280 with font scale 2.0. It renders the customer app; merchant verification awaits sign-in on this device (question pending). Do not overwrite the user's saved preferences merely to perform these checks.
