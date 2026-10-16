ALTER TABLE user ADD COLUMN can_manage_pricing INTEGER NOT NULL DEFAULT 0;
CREATE TABLE delivery_pricing_policy (
 id TEXT PRIMARY KEY NOT NULL,
 market_code TEXT NOT NULL DEFAULT 'CR',
 version TEXT NOT NULL,
 previous_version TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ACTIVE','RETIRED')),
 terms TEXT NOT NULL CHECK(json_valid(terms)),
 created_by_admin_id TEXT NOT NULL REFERENCES user(id),
 approved_reason TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 active_from INTEGER NOT NULL
);
CREATE UNIQUE INDEX delivery_pricing_version_unique ON delivery_pricing_policy(version);
CREATE UNIQUE INDEX delivery_pricing_revision_unique ON delivery_pricing_policy(market_code,revision) WHERE status != 'DRAFT';
CREATE UNIQUE INDEX delivery_pricing_parent_unique ON delivery_pricing_policy(market_code,previous_version) WHERE status != 'DRAFT';
CREATE TRIGGER delivery_pricing_published_immutable
BEFORE UPDATE OF terms,version,previous_version,revision,created_by_admin_id,approved_reason,created_at,active_from,market_code ON delivery_pricing_policy
WHEN OLD.status != 'DRAFT'
BEGIN SELECT RAISE(ABORT, 'Published delivery pricing is immutable'); END;
CREATE TRIGGER delivery_pricing_history_retained
BEFORE DELETE ON delivery_pricing_policy WHEN OLD.status != 'DRAFT'
BEGIN SELECT RAISE(ABORT, 'Published delivery pricing history must be retained'); END;
ALTER TABLE delivery_quote ADD COLUMN pricing_snapshot TEXT;
ALTER TABLE [order] ADD COLUMN delivery_pricing_snapshot TEXT;
ALTER TABLE delivery ADD COLUMN accepted_payout_minor INTEGER;
ALTER TABLE delivery_offer ADD COLUMN payout_minor INTEGER;
