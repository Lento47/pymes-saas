/**
 * How far from the pickup a courier may be and still be offered the run.
 *
 * **This number is the only thing standing between a widened pool and absurdity.** The
 * candidate set used to be "couriers who are members of this shop", which was a
 * geographic filter for free — a shop's roster is people who work there. Widening the
 * pool to every verified courier on the platform removes that for free, and a courier in
 * one city being offered a delivery in another is not a ranking problem, it is a bug a
 * user would report.
 *
 * 15 km is roughly the outer edge of a metropolitan delivery area, and it is a
 * square-then-circle like `businesses.ts`'s "near me": `boundingBox` narrows in SQL and
 * the haversine below rejects the corners, because a box's corner is `radius * 1.41` from
 * its centre. Without the second step a courier at the edge of a 15 km box gets runs 21 km
 * away.
 *
 * ## Why it lives here and not in `delivery-dispatch.ts`
 *
 * Because two audiences need it and they cannot both import a server module. The gate is
 * enforced in `packages/trpc-api/src/services/delivery-dispatch.ts`, which is server code.
 * But a merchant is owed an honest picture of it — `app/(business)/shop-location.tsx` draws
 * this exact number as a ring around the shop, so the reader can see how far a courier has
 * to be and no further.
 *
 * That ring is a **drawing of the rule**, and the day those two numbers differ it is
 * telling a merchant something untrue about who can reach their shop. A constant copied
 * into the app is a constant that will eventually differ, so this one is declared once, in a
 * package both sides already depend on, and imported by both.
 *
 * It is not the same number as a shop's `deliveryRadiusKm`, which is how far *that shop*
 * will deliver to a *buyer*, and which the merchant edits on the delivery screen. Nothing
 * links them and nothing should: one is a per-shop commercial decision, the other is a
 * platform-wide physical limit on assigning a human a bicycle ride.
 */
export const OFFER_RADIUS_KM = 15;
