# Android and iOS release runbook

## Build configuration

The application id and bundle id are both `app.pymeshub.lat`. EAS production builds use Node 22.13.1, remote versioning, automatic build-number increments, the `production` update channel, App Store distribution, and Android AAB output. Android submissions enter the internal track as a draft.

Before building, configure in EAS (never in Git):

- `EAS_PROJECT_ID` and the linked Expo project;
- Apple distribution certificate, provisioning profile, App Store Connect API key, team, and numeric app id;
- Android upload key and Google Play service-account key;
- production `EXPO_PUBLIC_API_URL`, Supabase public coordinates, and map-style URL;
- Worker secret `EXPO_ACCESS_TOKEN` if Expo push access security is enabled.
- `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT_MOBILE`, and a source-map-only `SENTRY_AUTH_TOKEN` for mobile release tracking.

Build with `eas build --profile production --platform all`. Submit first to TestFlight and the Google Play internal track; do not promote automatically.

## Store privacy declarations

The iOS privacy manifest declares no tracking and identifies account id, email, physical address, precise location, and user-selected photos/videos as linked data used for app functionality. Store questionnaires must also disclose:

- background precise location only during an assigned active delivery;
- device push token and notification delivery status;
- authentication, account/profile, saved addresses, orders, ratings, and merchant catalog photos;
- operational diagnostics after a monitoring provider is configured;
- deletion initiated in **Ajustes > Cuenta > Eliminar cuenta** with a seven-day cancellation period.

Public URLs:

- privacy: `https://pymeshub.lat/legal/privacy-policy`
- terms: `https://pymeshub.lat/legal/terms-of-service`
- location use: `https://pymeshub.lat/legal/location-use`
- account deletion: `https://pymeshub.lat/legal/account-deletion`
- support: `https://pymeshub.lat/support`

Google Data Safety and App Store privacy answers must be reviewed from the signed binary and production network traffic, not copied blindly from this list.

## Acceptance

Execute the evidence-based procedure in `docs/operations/mobile-field-pilot.md`; the release
candidate must produce a passing evaluator report before store promotion.

Test on physical Android and iOS devices:

1. A customer places a cash or SINPE order.
2. The merchant receives the alert, accepts, prepares, and marks it ready.
3. The assigned courier starts delivery after the pre-permission disclosure.
4. Location continues with the screen locked and Android shows its persistent notification.
5. The customer sees location freshness and order progress.
6. Completion stops location immediately and both rating flows work.
7. Every push opens the correct order screen from foreground, background, and terminated states.

Repeat with denied/revoked permissions, temporary offline mode, duplicate taps, cancellation, reassignment, stale GPS, and process restart. The current product assigns couriers directly; courier offer/expiration acceptance cannot be certified until that domain model exists.

## Progressive rollout

Promote internal → closed pilot → 10% → 25% → 50% → 100%. At each gate review crash-free sessions, API 5xx, completed deliveries, push ticket/receipt failures, and location freshness. Halt promotion on a regression and use the previous signed store build plus Worker rollback procedure.
