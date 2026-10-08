-- Tiers, and a cadence separate from the tier.
--
-- Two things were one thing. `plan` decided both *what a merchant gets* and *how often they
-- are invoiced*, which meant a shop could not hold 250 products on an annual invoice, nor
-- 15 products billed monthly. This splits them:
--
--   plan     FREE | EMPRENDE | STARTER | GROWTH | BUSINESS   -- what you get
--   cadence  MONTHLY | YEARLY                                -- how you are invoiced
--
-- The tier names and price points are inherited from the retired `apps/api` billing so a
-- merchant who read that price page does not meet a new product here. Only the system
-- moved: this is D1, and nothing in `apps/api` reads it.

-- ─────────────────────────────────────────────────────────────────────────────
-- Prices move to a child table: (book, tier, cadence) → minor.
--
-- A flat map rather than more columns, because a sixth tier or a third cadence is then an
-- insert instead of a migration, and because nullable columns make a half-populated book
-- representable — including a FREE row with a price, which is a price for something nobody
-- is ever charged.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE `price_book_price` (
	`price_book_id` text NOT NULL,
	`plan` text NOT NULL,
	`cadence` text NOT NULL,
	`minor` integer NOT NULL,
	FOREIGN KEY (`price_book_id`) REFERENCES `price_book`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `price_book_price_unique` ON `price_book_price` (`price_book_id`, `plan`, `cadence`);

-- ─────────────────────────────────────────────────────────────────────────────
-- Map the existing two plans onto two of the five tiers.
--
-- **Mapped, not dropped.** `WEEKLY` was the small paid tier and `MONTHLY` the large one,
-- so those are `EMPRENDE` and `STARTER`. A merchant's limits must not move because the
-- vocabulary was renamed: `STARTER` carries 250 products where `MONTHLY` carried 150, and
-- `EMPRENDE` carries 60 where `WEEKLY` carried 25 — both are raises, which is the safe
-- direction to be wrong in, and neither is a downgrade.
--
-- `business.plan` is denormalised and read on every product, location and staff write
-- (`schema.ts`), so it is remapped here too rather than left to disagree with `subscription`.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE `subscription` SET `plan` = 'EMPRENDE' WHERE `plan` = 'WEEKLY';
--> statement-breakpoint
UPDATE `subscription` SET `plan` = 'STARTER' WHERE `plan` = 'MONTHLY';
--> statement-breakpoint
UPDATE `business` SET `plan` = 'EMPRENDE' WHERE `plan` = 'WEEKLY';
--> statement-breakpoint
UPDATE `business` SET `plan` = 'STARTER' WHERE `plan` = 'MONTHLY';

-- ─────────────────────────────────────────────────────────────────────────────
-- The cadence, on the subscription only.
--
-- Backfilled to `MONTHLY` because that is the closest behaviour every existing row had:
-- a 30-day period and a price that did not change when the period rolled. `business` gets
-- **no** cadence column — limits follow the tier alone, and duplicating it there would put
-- a field nothing reads on the hottest path in the merchant app.
--
-- Every row here is a paid one after the remap above, so no row ends up on the floor with a
-- cadence it should not have.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE `subscription` ADD `cadence` text DEFAULT 'MONTHLY';
--> statement-breakpoint
UPDATE `subscription` SET `cadence` = NULL WHERE `plan` = 'FREE';

-- ─────────────────────────────────────────────────────────────────────────────
-- The floor is now FREE, so a business with no subscription row is no longer on a paid tier.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE `business` SET `plan` = 'FREE' WHERE `plan` NOT IN ('EMPRENDE','STARTER','GROWTH','BUSINESS');
--> statement-breakpoint
UPDATE `subscription` SET `plan` = 'FREE' WHERE `plan` NOT IN ('EMPRENDE','STARTER','GROWTH','BUSINESS');

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed the tiered prices onto the book that exists.
--
-- Written against `launch-2026` rather than a new book on purpose: **no existing merchant's
-- price moves.** `price_minor` is copied onto the subscription at the moment a period starts
-- (`schema.ts`), so these rows set what *new* periods are charged at while every row already
-- in flight keeps what it agreed to. That is the whole grandfathering mechanism, and it is
-- why a price rise is an insert and not an edit to this table.
--
-- Annual is ten months of monthly for every tier — one rule, 16.7% — so the pricing page
-- states a single saving instead of three unrelated discounts. `FREE` is absent from every
-- cadence: a free shop is never charged, and absence is what makes that checkable.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO `price_book_price` (`price_book_id`, `plan`, `cadence`, `minor`) VALUES
	('launch-2026', 'EMPRENDE', 'MONTHLY', 1090000),
	('launch-2026', 'EMPRENDE', 'YEARLY',  10900000),
	('launch-2026', 'STARTER',  'MONTHLY', 1990000),
	('launch-2026', 'STARTER',  'YEARLY',  19900000),
	('launch-2026', 'GROWTH',   'MONTHLY', 2990000),
	('launch-2026', 'GROWTH',   'YEARLY',  29900000),
	('launch-2026', 'BUSINESS', 'MONTHLY', 5990000),
	('launch-2026', 'BUSINESS', 'YEARLY',  59900000);

-- The two price columns are dropped **last**, after the backfill above is verified against
-- `price_minor`. Leaving them would mean a book that carries two prices for the same thing
-- and no statement about which is authoritative.
ALTER TABLE `price_book` DROP COLUMN `weekly_minor`;
--> statement-breakpoint
ALTER TABLE `price_book` DROP COLUMN `monthly_minor`;