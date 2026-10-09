-- A courier can carry one active delivery. The offer indices only guard one
-- courier per order; this partial index guards one active order per courier.
-- Terminal deliveries remain in history without consuming capacity.
CREATE UNIQUE INDEX `delivery_courier_active_unique` ON `delivery` (`courier_user_id`) WHERE `status` IN ('ACCEPTED', 'TO_PICKUP', 'AT_PICKUP', 'PICKED_UP');
