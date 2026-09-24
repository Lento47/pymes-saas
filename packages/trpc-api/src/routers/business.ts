import {
	BUSINESS_STATUSES,
	businessCreateInput,
	businessUpdateInput,
	locationCreateInput,
	locationPauseInput,
	locationScopeInput,
	membershipRoleSchema,
} from "@pymeshub/shared";
import { z } from "zod";

import { rateLimit } from "../context";
import * as businesses from "../services/businesses";
import { assertRole } from "../services/helpers";
import * as merchantHome from "../services/home";
import * as locations from "../services/locations";
import { businessProcedure, protectedProcedure, router } from "../trpc";

/** Ten invitations a minute: a real onboarding session adds a handful of people, a probe does not stop. */
const INVITE_LIMIT = 10;
const INVITE_WINDOW_SECONDS = 60;

/**
 * The business side of the marketplace: the dashboard a member of a shop uses.
 *
 * Every procedure here except `myBusinesses` and `create` goes through
 * `businessProcedure(…)`, which answers the `businessId` in the input against `membership`
 * before the body runs. Nothing below reads that input again — the services scope by
 * `ctx.membership.businessId`, so a `businessId` the caller is not a member of produces a
 * `FORBIDDEN` at the middleware and never reaches a query.
 *
 * The capability names the *coarse* gate, and it is the loosest role that may use the
 * procedure: MANAGER-and-OWNER actions are then narrowed with `assertRole`, because
 * `staff:manage` and `business:settings` are both held by MANAGER. Where the contract asks
 * for "any member" there is no dedicated capability — `orders:read` is the one all three
 * roles hold, and reaching for `business:settings` would lock STAFF out of the screen they
 * open at the start of every shift.
 */
export const businessRouter = router({
	/** The app's business switcher. Any signed-in user, no membership required to ask. */
	myBusinesses: protectedProcedure.query(({ ctx }) =>
		businesses.myBusinesses(ctx),
	),

	home: businessProcedure("orders:read")
		.input(locationScopeInput)
		.query(({ ctx, input }) => merchantHome.home(ctx, input.locationId)),

	settings: businessProcedure("orders:read")
		.input(z.object({ businessId: z.string() }))
		.query(({ ctx }) =>
			businesses.settings(ctx, { businessId: ctx.membership.businessId }),
		),

	locations: businessProcedure("orders:read")
		.input(z.object({ businessId: z.string() }))
		.query(({ ctx }) => locations.list(ctx)),

	locationStatus: businessProcedure("orders:read")
		.input(locationScopeInput)
		.query(({ ctx, input }) => locations.status(ctx, input.locationId)),

	createLocation: businessProcedure("business:settings")
		.input(locationCreateInput)
		.mutation(({ ctx, input }) => {
			assertRole(ctx, "OWNER");
			return locations.create(ctx, input);
		}),

	pauseLocation: businessProcedure("business:settings")
		.input(locationPauseInput)
		.mutation(({ ctx, input }) => locations.pause(ctx, input)),

	resumeLocation: businessProcedure("business:settings")
		.input(locationScopeInput)
		.mutation(({ ctx, input }) => locations.resume(ctx, input.locationId)),

	update: businessProcedure("business:settings")
		.input(
			z.intersection(z.object({ businessId: z.string() }), businessUpdateInput),
		)
		.mutation(({ ctx, input }) =>
			businesses.update(ctx, {
				...input,
				businessId: ctx.membership.businessId,
			}),
		),

	/**
	 * Any signed-in user may open a shop, and the service writes their OWNER membership in
	 * the same `batch` — which is why this is a `protectedProcedure` and not a
	 * `businessProcedure`: there is no membership to check yet, the caller is creating it.
	 */
	create: protectedProcedure
		.input(businessCreateInput)
		.mutation(({ ctx, input }) => businesses.create(ctx, input)),

	/**
	 * ACTIVE↔CLOSED only. `business.settings` is MANAGER's, so the capability alone would
	 * let a manager close the shop; the `assertRole` is the actual gate, and the service
	 * refuses SUSPENDED regardless — that one belongs to the admin surface.
	 */
	setStatus: businessProcedure("business:settings")
		.input(
			z.object({
				businessId: z.string(),
				// Extracted from the stored enum rather than retyped: a status added to
				// `BUSINESS_STATUSES` later must not silently become settable here, and the
				// two lists cannot drift if there is only one list.
				status: z.enum(BUSINESS_STATUSES).extract(["ACTIVE", "CLOSED"]),
			}),
		)
		.mutation(({ ctx, input }) => {
			assertRole(ctx, "OWNER");
			return businesses.setStatus(ctx, {
				...input,
				businessId: ctx.membership.businessId,
			});
		}),

	staff: businessProcedure("staff:manage")
		.input(z.object({ businessId: z.string() }))
		.query(({ ctx }) => businesses.staff(ctx)),

	/**
	 * The one business procedure that can be used to probe which addresses have an account,
	 * so it is rate-limited per caller before anything is read — the limit is a property of
	 * the action, not of the target, and a manager adding a real colleague hits it never.
	 */
	inviteStaff: businessProcedure("staff:manage")
		.input(
			z.object({
				businessId: z.string(),
				email: z.string().email().max(200),
				role: membershipRoleSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await rateLimit(
				ctx.env,
				"business:inviteStaff",
				ctx.user.id,
				INVITE_LIMIT,
				INVITE_WINDOW_SECONDS,
			);
			return businesses.inviteStaff(ctx, {
				...input,
				businessId: ctx.membership.businessId,
			});
		}),

	updateStaffRole: businessProcedure("staff:manage")
		.input(
			z.object({
				businessId: z.string(),
				userId: z.string(),
				role: membershipRoleSchema,
			}),
		)
		.mutation(({ ctx, input }) => {
			assertRole(ctx, "OWNER");
			return businesses.updateStaffRole(ctx, {
				...input,
				businessId: ctx.membership.businessId,
			});
		}),

	removeStaff: businessProcedure("staff:manage")
		.input(z.object({ businessId: z.string(), userId: z.string() }))
		.mutation(({ ctx, input }) => {
			assertRole(ctx, "OWNER");
			return businesses.removeStaff(ctx, {
				...input,
				businessId: ctx.membership.businessId,
			});
		}),

	analytics: businessProcedure("analytics:read")
		.input(
			z.object({
				businessId: z.string(),
				locationId: z.string(),
				from: z.date(),
				to: z.date(),
			}),
		)
		.query(({ ctx, input }) =>
			businesses.analytics(ctx, {
				...input,
				businessId: ctx.membership.businessId,
			}),
		),
});
