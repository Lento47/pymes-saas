import { router } from "../trpc";
import { adminRouter } from "./admin";
import { affiliationsRouter } from "./affiliations";
import { businessRouter } from "./business";
import { businessesRouter } from "./businesses";
import { cartRouter } from "./cart";
import { catalogRouter } from "./catalog";
import { couriersRouter } from "./couriers";
import { crashReportRouter } from "./crash-report";
import { deliveriesRouter } from "./deliveries";
import { devicesRouter } from "./devices";
import { favoritesRouter } from "./favorites";
import { healthRouter } from "./health";
import { ideaRouter } from "./idea";
import { identityRouter } from "./identity";
import { notificationsRouter } from "./notifications";
import { ordersRouter } from "./orders";
import { productsRouter } from "./products";
import { promotionsRouter } from "./promotions";
import { reviewsRouter } from "./reviews";
import { subscriptionRouter } from "./subscription";
import { supportRouter } from "./support";
import { uploadsRouter } from "./uploads";
import { usersRouter } from "./users";

/**
 * The whole API surface, in one tree.
 *
 * The namespaces are the ones `docs/api-surface.md` names, and they are the reason the two
 * sides of a business are two routers: `businesses` is what any customer browses, `business`
 * is what a member administers. A client never guesses which one it is looking at — the
 * procedure name it already holds says so.
 *
 * This file is the only place the tree is assembled, which is what makes `AppRouter` from
 * `apps/api/src/app-router.ts` complete by construction: a router that exists but is not
 * named here is a router no client can call, and the type will not mention it.
 */
export const appRouter = router({
	health: healthRouter,
	catalog: catalogRouter,
	businesses: businessesRouter,
	products: productsRouter,
	users: usersRouter,
	cart: cartRouter,
	couriers: couriersRouter,
	deliveries: deliveriesRouter,
	devices: devicesRouter,
	orders: ordersRouter,
	favorites: favoritesRouter,
	notifications: notificationsRouter,
	business: businessRouter,
	promotions: promotionsRouter,
	reviews: reviewsRouter,
	/**
	 * The merchant side of a support ticket: raise one, read the thread, add to it, and move
	 * it between `OPEN` and `WAITING`. Resolving and closing are `admin`'s, not this
	 * router's — see `routers/support.ts` for why that split is the contract's and not a
	 * missing permission check.
	 */
	support: supportRouter,
	/**
	 * Crashes, as a queue an operator works. **Not** under `support`, and the separation is
	 * the point: `support` is a merchant asking about their shop, gated on a membership, and
	 * a crash belongs to a phone that may belong to nobody. `support_ticket` also *blocks a
	 * business delete*, which a stack trace must not do. See `routers/crash-report.ts`.
	 */
	crashReport: crashReportRouter,
	/**
	 * Product feedback from any signed-in user. **Not** under `support`: a ticket is
	 * a merchant asking about their shop, gated on a membership, and an idea belongs
	 * to a person who may have no shop at all. See `routers/idea.ts`.
	 */
	idea: ideaRouter,
	// Was `payouts`, a list of settlement runs. The consumer pays the merchant and the
	// courier directly, so there is nothing to settle and the namespace now holds the
	// merchant's own subscription. `payouts:read` survives as the capability name —
	// it still answers "may this person see what the business owes the platform".
	subscription: subscriptionRouter,
	uploads: uploadsRouter,
	/**
	 * Who somebody is: a shop's public profile, an invitation link resolved before there is a
	 * session, and the caller's own identity. **Not** under `business` — two of its three
	 * procedures are public and the third answers about a person, so it is the one namespace
	 * where `businessProcedure`'s invariant does not apply. See `routers/identity.ts`.
	 */
	identity: identityRouter,
	/**
	 * The invitee's half of an affiliation: accept, decline, leave. **Not** under `business`
	 * for the reason above in its strongest form — accepting an invitation acts on a
	 * membership that is `PENDING_USER_ACCEPTANCE`, which is by definition absent from the
	 * caller's memberships, so `businessProcedure` could not resolve it. See
	 * `routers/affiliations.ts`.
	 */
	affiliations: affiliationsRouter,
	admin: adminRouter,
});

export type AppRouter = typeof appRouter;
