# Mobile field-pilot procedure

This pilot is the release proof for the customer, merchant, and courier experience. It uses
signed store-distribution builds on physical phones and real staging services. Simulator,
Expo Go, source tests, and screenshots by themselves do not satisfy this procedure.

## Prepare the run

1. Build Android and iOS from the exact candidate commit. Record the EAS build ids, version,
   build numbers, commit SHA, API release, and D1 migration in the evidence file.
2. Copy `docs/templates/mobile-pilot-evidence.json` outside the repository for the live run.
   Do not commit real email addresses, delivery addresses, device tokens, coordinates, order
   notes, or Sentry event payloads.
3. Install through Google Play internal testing and TestFlight. Use at least two Android OS
   versions from different manufacturers and two iOS versions.
4. Prepare separate customer, merchant, courier, and disposable-deletion accounts. Give the
   merchant a published, open location with one low-value product, cash and SINPE enabled,
   and the courier already assigned to the business.
5. Start screen recording on the customer and merchant phones. On the courier phone, record
   the permission disclosure, system permission choice, locked-screen interval, Android
   foreground notification, and final tracking shutdown without exposing the address.

## Run twenty acceptance orders

Use a fresh order for every row in `runs`; never repair a row directly in D1. Alternate
Android and iOS between customer and courier roles, and exercise both Wi-Fi and cellular.

1. Customer signs in, adds the configured product, chooses delivery, selects an address,
   chooses cash or SINPE, reviews the total, and places the order once. Record the order id.
2. Merchant receives the new-order notification, opens that order, accepts it, begins
   preparation, marks it ready, and assigns the prepared courier account.
3. Courier receives the assigned run, reads the location disclosure, grants the required
   permission, and starts delivery. Lock the phone for at least 15 minutes while travelling
   or replaying a safe test route.
4. Customer verifies the courier marker and freshness line throughout the locked interval.
   Record periodic location ages without recording coordinates.
5. Courier completes the delivery. Confirm the task and Android foreground notification stop
   within 60 seconds. Customer and courier submit their available rating flows.
6. Record push ticket/receipt results, deep-link destination, API request/5xx totals, crashes,
   and whether any operator changed application or database state manually.

An acceptance run is `completed` only when all six steps finish without manual repair. Add
every discovered defect immediately; a critical or high defect must be resolved and retested.

## Failure drills

Run these outside the twenty clean orders and attach their order ids or recordings:

- deny foreground location, then grant it from system settings;
- revoke background location during a run;
- disable network temporarily, move, reconnect, and verify the latest position is retried;
- force-stop/restart the courier process during an assigned run;
- double-tap state-changing controls and confirm one transition;
- cancel before preparation, cancel/reject from the merchant path, and reassign the courier;
- sign the courier out during tracking;
- open an order notification in foreground, background, and terminated states;
- request deletion on the disposable account, verify status, cancel it, request again, run the
  due-deletion procedure in staging, and verify deletion/anonymization results.

For each tracking-stop drill, add a `trackingStops` entry using one of `delivered`,
`cancelled`, `reassigned`, `signed_out`, or `permission_revoked` and its measured latency.

## Evidence format

- `builds`: `{ platform, buildId, version, buildNumber, commitSha, signed: true }`.
- `devices`: `{ id, platform, manufacturer, model, osVersion }`; use aliases, not advertising ids.
- `runs`: `{ id, orderId, status, manualRepair, customerDevice, courierDevice, paymentMethod,
network, customerRatingSubmitted, courierRatingSubmitted }`; `network` is `wifi`, `cellular`,
  or `switched`.
- `defects`: `{ id, severity, status, runId }`; severity is `critical`, `high`, `medium`, or `low`.
- `pushes`: `{ id, orderId, kind, appState, ticketStatus, receiptStatus, deepLinkOpened }`.
  Capture `merchant_new_order`, `accepted`, `preparing`, `ready`, `out_for_delivery`,
  `delivered`, `rejected`, and `cancelled` across the normal runs and failure drills.
- `locationSamples`: `{ id, orderId, deviceId, ageSeconds }`; never include latitude/longitude.
- `backgroundRuns`: `{ orderId, platform, screenLockedMinutes, continued,
persistentNotification }`; the last field is required for Android.
- `artifacts`: store links or restricted artifact ids only. Keep recordings and exports in the
  approved restricted release folder, not Git.

Export aggregate session and API metrics from Sentry/Cloudflare for the same build and pilot
window. Counts must cover the pilot traffic; do not enter estimated percentages.

## Make the release decision

Run:

```bash
pnpm pilot:mobile:test
pnpm pilot:mobile:evaluate -- /secure/path/mobile-pilot-evidence.json \
  --output /secure/path/mobile-pilot-report.md
```

The evaluator returns exit code 0 only when every gate passes: signed builds and device
coverage, twenty clean orders, no unresolved severe defects, at least 99% crash-free sessions,
less than 1% API 5xx, at least 95% successful push/deep-link samples, at least 95% fresh
locations, background tracking on both platforms, all five tracking-stop conditions, and the
full deletion lifecycle.

After a production deployment, repeat five smoke deliveries using the signed production
builds. Do not reuse staging evidence or promote rollout percentages after a failed report.
