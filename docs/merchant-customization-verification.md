# Merchant customization verification

Status: implementation published; native acceptance is incomplete. Updated 2026-10-15.

## Confirmed evidence

| Requirement | Evidence |
| --- | --- |
| User/business isolation, staff personal preferences, owner/manager shop editing, stale-write rejection | `packages/trpc-api/test/customization.test.ts` |
| Private drafts, publish/discard/default behavior, private photo edits and atomic photo publishing | Same API tests: 5 pass after `15bf2ca2`; injected publish failure rolls photos back |
| Compatibility, Simple presets, operational widgets fixed and visible, readable accent suggestions | `packages/shared/src/schemas/customization.test.ts`: 15 pass |
| Mobile regression coverage | Full mobile suite: 371 pass after business fallback and full-height photo editor; 14 focused customization checks pass after large-text selector changes |
| Discard unsaved changes and prevent overlapping save/publish/discard actions | Mobile TypeScript and 14 focused customization UI checks pass |
| Type safety | Mobile, shared, API and DB typechecks pass after photo consolidation |
| Deployment | Production API version `d94fcd94-8c76-43eb-b782-ae4c53c7cdb2`; `/health` returned 200 with DB healthy |
| Spanish merchant rendering | Current local bundle and existing merchant login recovered on `emulator-5554`; Personalization and its photo editor inspected at normal size and 720×1280 with 200% text |
| Public small-screen rendering | Published photos and compact hours inspected at 720×1280 with 200% text, Spanish/light and English/dark on the spare emulator |
| Home business card | Photo and details now share one clipped surface and press target; joined layout inspected in English/dark on the spare emulator |
| Cover header readability and brand decoration | Identity has an opaque theme canvas and grows with text. Short rounded gradient above the name matches the preview. Inspected in Spanish/light at normal and 200% text, and Spanish/dark at 200%, on 720×1280. Status icons now have a matching opaque canvas over bright covers |
| Reduced-motion drag settling | Tiles return immediately to rest when reduced motion is enabled; mobile TypeScript and 16 focused checks pass. Native editor gesture acceptance remains pending |
| Fresh editor entry | Direct launches without a business parameter now fall back to the account's first business; explicit route/scope selections take priority. Saved photos load after a fresh bundle reload, and business-list failures have a retry action |
| Large-text controls | Photo editor now opens full height; logo and Done can scroll fully into view at 200%. Dashboard Compact/Detailed cards stack with complete labels; header, metric and widget-layout choices use the same large-text treatment |
| Photo picker entry/cancel/removal | Native gallery and 16:9 crop frame opened at 200%; crop canceled before upload. Local cover removal and Done checked; no draft saved or published |

Photo controls now live only in Personalization → Customer shop. Uploaded asset paths use the app's image resolver. Photo changes remain private until Publish; settings forms no longer send stale image values.

## Remaining native acceptance

- [ ] Complete native photo upload/save/restart/publish and confirm the customer view. Gallery/crop entry, cancellation, local removal and Done have been checked without saving.
- [ ] Confirm saved preferences synchronize between two actual app sessions. API tests already verify separate authenticated callers.
- [ ] Check the final editors in both color schemes and languages, on a small screen with 200% text.
- [x] Recheck the revised cover header in dark mode at 200% text, including status icons over a bright cover.
- [ ] Check TalkBack focus/actions and reduced motion, including fixed operational widgets.
- [ ] Confirm orders remain reachable with optional dashboard widgets hidden and reordered.
- [ ] Confirm product browsing, search, cart, reviews and checkout remain reachable with both shop headers and all optional sections hidden/reordered.

Native verification is unblocked. The main emulator's release APK was backed up to `%TEMP%/pymeshub-main-before-verification.apk`, then the existing `%TEMP%/pymeshub-verification.apk` was installed with `adb install -r -d`, retaining the merchant login. Its development host is `localhost:8081` with ADB reverse. No APK was generated. Use the native Reload control when checking file changes: Fast Refresh did not reliably apply them during this session. The setup question is superseded; a new login is unnecessary on this device.

The main emulator was restored to 1080×2400, density 420, font scale 1.0, Spanish/light, and its original accessibility settings. The spare is closed. No dashboard changes or shop drafts were saved or published; local test edits were cleared by bundle reload. The temporary imported crop image was removed.
