-- Express delivery as a speed, and the weekly quota that counts it.
--
-- The quota is a **usage limit on the business**, not a subsidy and not a discount: the
-- customer pays the courier, and always did. What a tier changes is how many express orders
-- the shop may *accept* in a week. Nothing here touches who pays for a delivery.

-- ─────────────────────────────────────────────────────────────────────────────
-- Speed is a second axis from `fulfilment`, not a third value of it.
--
-- `fulfilment` answers whether the customer comes to the shop or the goods come to them,
-- and urgency is orthogonal — a pickup can be wanted in ten minutes and a delivery next
-- week. Defaulted to STANDARD because an order placed before this column existed is a
-- standard one, and reading those as express would charge a shop a quota it never spent.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE `order` ADD `delivery_speed` text DEFAULT 'STANDARD' NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Counting express orders per business per window is on the accept path, so it is indexed.
--
-- The index covers `(business_id, accepted_at)` and the window filter is a range on
-- `accepted_at`, which is what the count reads — it is anchored there rather than on
-- `placed_at` because the quota is spent at acceptance, so an order placed Sunday and
-- accepted Monday spent Monday's quota.
--
-- `delivery_speed` is in the index for the same reason `status` is on the order indexes: a
-- hot-path filter that is not in the index turns one read into a scan of the shop's history.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX `order_business_express_accepted_idx` ON `order` (`business_id`, `delivery_speed`, `accepted_at`);