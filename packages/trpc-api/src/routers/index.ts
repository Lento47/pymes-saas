import { router } from "../trpc";
import { adminRouter } from "./admin";
import { businessRouter } from "./business";
import { businessesRouter } from "./businesses";
import { cartRouter } from "./cart";
import { catalogRouter } from "./catalog";
import { favoritesRouter } from "./favorites";
import { healthRouter } from "./health";
import { notificationsRouter } from "./notifications";
import { ordersRouter } from "./orders";
import { payoutsRouter } from "./payouts";
import { productsRouter } from "./products";
import { reviewsRouter } from "./reviews";
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
	orders: ordersRouter,
	favorites: favoritesRouter,
	notifications: notificationsRouter,
	business: businessRouter,
	reviews: reviewsRouter,
	payouts: payoutsRouter,
	admin: adminRouter,
});

export type AppRouter = typeof appRouter;
