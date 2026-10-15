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
| Normal-size Spanish merchant rendering | Earlier observations on `emulator-5554` need revalidation against the current local bundle: the device later showed the old photo-settings screen |
| Public small-screen rendering | Published photos and compact hours inspected at 720×1280 with 200% text, Spanish/light and English/dark on the spare emulator |
| Home business card | Photo and details now share one clipped surface and press target; joined layout inspected in English/dark on the spare emulator |
| Cover header readability and brand decoration | Identity has an opaque theme canvas and grows with text. Short rounded gradient above the name matches the preview. Inspected in Spanish/light at normal and 200% text, and Spanish/dark at 200%, on 720×1280. Status icons now have a matching opaque canvas over bright covers |
| Reduced-motion drag settling | Tiles return immediately to rest when reduced motion is enabled; mobile TypeScript and 16 focused checks pass. Native editor gesture acceptance remains pending |

Photo controls now live only in Personalization → Customer shop. Uploaded asset paths use the app's image resolver. Photo changes remain private until Publish; settings forms no longer send stale image values.

## Remaining native acceptance

- [ ] Select, crop, remove and preview logo/banner; save a draft, restart, publish, then confirm the customer view.
- [ ] Confirm saved preferences synchronize between two actual app sessions. API tests already verify separate authenticated callers.
- [ ] Check the final editors in both color schemes and languages, on a small screen with 200% text.
- [x] Recheck the revised cover header in dark mode at 200% text, including status icons over a bright cover.
- [ ] Check TalkBack focus/actions and reduced motion, including fixed operational widgets.
- [ ] Confirm orders remain reachable with optional dashboard widgets hidden and reordered.
- [ ] Confirm product browsing, search, cart, reviews and checkout remain reachable with both shop headers and all optional sections hidden/reordered.

Both emulators closed during verification. Only `pymeshub-api36` was reopened; it now reports a release APK without `DEBUGGABLE`, and `run-as` is unavailable. This app cannot verify the current local bundle. The cached development APK remains at `%TEMP%/pymeshub-verification.apk`; no APK was generated. The spare's last tested settings were 720×1280, font scale 2.0, Spanish/light, normal animation scale, and TalkBack disabled. A device/setup question is pending before continuing signed-in checks. No dashboard changes or shop drafts were saved or published during this inspection.
