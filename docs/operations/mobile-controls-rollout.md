# Mobile controls and update rollout

Status: implementation in progress. No initial configuration has been published, no migration
has been applied remotely, and no APK build or software update has been started for this work.

## Scope and invariants

The shared registry is `packages/shared/src/mobile-controls.ts`. Controls change availability,
not layout or permissions. Unknown controls remain compatible with older readers. The default
configuration keeps current availability. Customer, merchant and courier completion routes,
authentication, recovery, support, sign-out, payments and tracking cannot be switched off.

The mobile category setting is independent of shared category activation. Hidden category IDs
stay saved when the global category switch is off. Product assignments and web behavior remain.

## Storage and authorization

Migration `0037_mobile_controls.sql` adds one versioned draft, immutable published revisions,
and `user.can_publish_mobile`. Only existing active admins with `can_manage_pricing` receive
that dedicated permission in the migration. General admin access does not confer publication.
Revoking admin access clears both explicit capabilities.

Platform admins edit and discard drafts. Super Admin publication/restoration creates a new
immutable revision and an audit row in one D1 batch. Optimistic draft versions and a database
head check reject concurrent edits/publications. Public `mobile.published` reads only the
published head. Draft, publish, discard, restore and history are authenticated admin procedures.

## Mobile freshness

The provider uses a 60-second freshness window on launch/foreground return, manual refresh,
no periodic polling, and an origin-scoped persisted validated snapshot. Failed or future-format
responses cannot block navigation. Without a validated snapshot the bundled behavior applies.
Android/iOS operational writes consult the current publication at their API boundary; web and
unidentified older clients keep their existing behavior. A completed checkout retry returns its
existing order even after new checkout is paused.

## Remaining implementation and acceptance gates

- Finish web App móvil: searchable role/screen switches, category selection, uploaded bilingual
  campaigns/announcements, real-data previews, draft lifecycle and publication/history UI.
- Finish mobile navigation entries, sections, personalized dashboards, tools, forms and write
  affordances. Individual category deep links and all category/campaign fallbacks must obey
  publication, without preventing product/business search or transaction completion.
- Verify courier acceptance and availability boundaries, all three roles, empty sections,
  concurrent draft publication, revocation, and publication audit rollback.
- Verify the real preview/production EAS channel mapping and installed-build runtime. Prepare
  preview-first software promotion, explicit production approval, native-version compatibility
  checks and compatible rollback. Content publication must not invoke APK/EAS software release.
- Verify background update download, activation on the next launch, runtime mismatch rejection
  and rollback on a release build; never force restart during an active task.
- Add the supporting-release verification gate before the initial category-hiding publication.
- Run shared, database, API, console and mobile checks. Check ES/EN, both themes, small screens,
  200% text, screen readers, reduced motion, offline/restart/foreground/manual refresh, unknown
  controls and older clients. Inspect actual rendered screens and deployed behavior.
- Apply the migration before API/console deployment. Verify the supporting mobile release before
  publishing the initial configuration: categories off; all other availability unchanged.

Verification so far: schema/database type checks, migration/schema drift checks, Super Admin
permission seeding, shared policy tests, offline snapshot tests, API draft/publication isolation,
concurrency, restoration/history immutability, atomic audit rollback, and mobile/web checkout
boundary and idempotency tests pass. This is foundation evidence, not rollout acceptance.
