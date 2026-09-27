import { router } from "../trpc";
import { adminRouter } from "./admin";
import { businessRouter } from "./business";
import { businessesRouter } from "./businesses";
import { cartRouter } from "./cart";
import { catalogRouter } from "./catalog";
import { couriersRouter } from "./couriers";
import { favoritesRouter } from "./favorites";
import { healthRouter } from "./health";
import { notificationsRouter } from "./notifications";
import { ordersRouter } from "./orders";
import { productsRouter } from "./products";
import { promotionsRouter } from "./promotions";
import { reviewsRouter } from "./reviews";
import { subscriptionRouter } from "./subscription";
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
	orders: ordersRouter,
	favorites: favoritesRouter,
	notifications: notificationsRouter,
	business: businessRouter,
	promotions: promotionsRouter,
	reviews: reviewsRouter,
	// Was `payouts`, a list of settlement runs. The consumer pays the merchant and the
	// courier directly, so there is nothing to settle and the namespace now holds the
	// merchant's own subscription. `payouts:read` survives as the capability name —
	// it still answers "may this person see what the business owes the platform".
	subscription: subscriptionRouter,
	uploads: uploadsRouter,
	admin: adminRouter,
});

export type AppRouter = typeof appRouter;
