import {
	affiliationInviteInput,
	affiliationListInput,
	affiliationRevokeInput,
	BUSINESS_STATUSES,
	businessAuditHistoryInput,
	businessCreateInput,
	businessUpdateInput,
	dashboardPreferencesInputSchema,
	locationCreateInput,
	locationPauseInput,
	locationScopeInput,
	MARKET_TIME_ZONE,
	membershipRoleSchema,
	storefrontAppearanceSchema,
	verificationRequestInput,
	verificationScopeInput,
} from "@pymeshub/shared";
import { z } from "zod";

import { rateLimit } from "../context";
import * as affiliations from "../services/affiliations";
import * as businessVerification from "../services/business-verification";
import * as businesses from "../services/businesses";
import * as customization from "../services/customization";
import { assertRole } from "../services/helpers";
import * as merchantHome from "../services/home";
import * as locations from "../services/locations";
import { businessProcedure, protectedProcedure, router } from "../trpc";

/** Ten invitations a minute: a real onboarding session adds a handful of people, a probe does not stop. */
const INVITE_LIMIT = 10;
const INVITE_WINDOW_SECONDS = 60;

/**
 * Five verification applications an hour.
 *
 * Looser than it sounds, and deliberately: the partial unique index allows one *open*
 * application per shop, so the realistic sequence is apply → rejected → apply → rejected, and
 * a shop that has been refused twice in twenty minutes is a shop fixing a tax id and trying
 * again. Five leaves room for that and stops a script, which is the whole job of a limiter on
 * a path whose only cost is a reviewer's attention.
 */
const VERIFICATION_REQUEST_LIMIT = 5;
const VERIFICATION_WINDOW_SECONDS = 60 * 60;

/**
 * The business side of the marketplace: the dashboard a member of a shop uses.
 *
 * Every procedure here except `myBusinesses`, `pendingInvitations` and `create`
 * goes through `businessProcedure(…)`, which answers the `businessId` in the input
 * against `membership` before the body runs. Nothing below reads that input again
 * — the services scope by `ctx.membership.businessId`, so a `businessId` the
 * caller is not a member of produces a `FORBIDDEN` at the middleware and never
 * reaches a query.
 *
 * The three exceptions are the same kind of thing: they answer questions about
 * the **caller** rather than about a shop, so there is no `businessId` to check
 * against and no tenant to scope to. `myBusinesses` and `pendingInvitations`
 * describe which shops the caller may use and which have asked them to, and
 * `create` is the act that makes the first one true.
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

	/**
	 * Invitations this person has not answered yet.
	 *
	 * A procedure of its own rather than a field on `myBusinesses`, so that the two
	 * lists cannot be confused: everything `myBusinesses` returns is a shop the
	 * caller may operate, and nothing this returns is. See the service for why that
	 * separation is structural rather than cosmetic.
	 *
	 * `protectedProcedure` and nothing more: this is the caller's own inbox, so
	 * there is no tenant to check and no capability to require.
	 */
	pendingInvitations: protectedProcedure.query(({ ctx }) =>
		businesses.pendingInvitations(ctx),
	),

	home: businessProcedure("orders:read")
		.input(locationScopeInput)
		.query(({ ctx, input }) => merchantHome.home(ctx, input.locationId)),

	dashboardPreferences: businessProcedure("orders:read")
		.input(z.object({ businessId: z.string() }))
		.query(({ ctx }) => customization.readDashboard(ctx)),
	saveDashboardPreferences: businessProcedure("orders:read")
		.input(
			z.object({
				businessId: z.string(),
				revision: z.number().int().min(0),
				configuration: dashboardPreferencesInputSchema,
			}),
		)
		.mutation(({ ctx, input }) =>
			customization.saveDashboard(ctx, input.configuration, input.revision),
		),
	restoreDashboardPreferences: businessProcedure("orders:read")
		.input(
			z.object({ businessId: z.string(), revision: z.number().int().min(0) }),
		)
		.mutation(({ ctx, input }) =>
			customization.restoreDashboardDefault(ctx, input.revision),
		),

	shopAppearance: businessProcedure("business:settings")
		.input(z.object({ businessId: z.string() }))
		.query(({ ctx }) => customization.readShop(ctx)),
	shopPreview: businessProcedure("business:settings")
		.input(z.object({ businessId: z.string() }))
		.query(({ ctx }) => businesses.previewForBusiness(ctx)),
	saveShopDraft: businessProcedure("business:settings")
		.input(
			z.object({
				businessId: z.string(),
				revision: z.number().int().min(0),
				configuration: storefrontAppearanceSchema,
			}),
		)
		.mutation(({ ctx, input }) =>
			customization.saveShopDraft(ctx, input.configuration, input.revision),
		),
	publishShopDraft: businessProcedure("business:settings")
		.input(
			z.object({ businessId: z.string(), revision: z.number().int().min(0) }),
		)
		.mutation(({ ctx, input }) =>
			customization.publishShop(ctx, input.revision),
		),
	discardShopDraft: businessProcedure("business:settings")
		.input(
			z.object({ businessId: z.string(), revision: z.number().int().min(0) }),
		)
		.mutation(({ ctx, input }) =>
			customization.discardShopDraft(ctx, input.revision),
		),
	restoreShopDefault: businessProcedure("business:settings")
		.input(
			z.object({ businessId: z.string(), revision: z.number().int().min(0) }),
		)
		.mutation(({ ctx, input }) =>
			customization.restoreShopDefault(ctx, input.revision),
		),

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

	auditHistory: businessProcedure("business:settings")
		.input(businessAuditHistoryInput)
		.query(({ ctx, input }) => {
			assertRole(ctx, "OWNER");
			return businesses.auditHistory(ctx, input);
		}),

	/**
	 * Apply for platform verification. `business:settings` is OWNER and MANAGER, which is
	 * exactly the contract — an employee does not submit a tax id on the company's behalf.
	 *
	 * Rate-limited, and this is one of the two paths the Phase 2 brief named: the act costs a
	 * reviewer's attention rather than a database row, and a rejected shop can re-apply
	 * immediately by design, so nothing else bounds how often a determined script could put
	 * work in the queue.
	 */
	requestVerification: businessProcedure("business:settings")
		.input(verificationRequestInput)
		.mutation(async ({ ctx, input }) => {
			await rateLimit(
				ctx.env,
				"business:requestVerification",
				ctx.user.id,
				VERIFICATION_REQUEST_LIMIT,
				VERIFICATION_WINDOW_SECONDS,
			);
			return businessVerification.requestVerification(ctx, {
				...input,
				businessId: ctx.membership.businessId,
			});
		}),

	/**
	 * The shop's own view of its verification, with the history behind it.
	 *
	 * `business:settings` rather than OWNER-only: a manager needs to know whether the shop is
	 * verified to answer a customer, and the response carries no evidence — no tax id, no legal
	 * name, no reviewer's note. The applicant's own submission is already on the request rows
	 * the manager's colleagues wrote.
	 */
	verification: businessProcedure("business:settings")
		.input(verificationScopeInput)
		.query(({ ctx }) => businessVerification.verification(ctx)),

	staff: businessProcedure("staff:manage")
		.input(z.object({ businessId: z.string() }))
		.query(({ ctx }) => businesses.staff(ctx)),

	/**
	 * Everybody who has ever been part of this shop: the team, the invitations nobody has
	 * answered, and the people who left.
	 *
	 * A separate read from `staff` rather than a wider `staff`, because the two answer
	 * different questions and are gated differently: `staff` is "who works here", which a
	 * courier needs to see to know who to call, and this is the affiliation ledger, which is
	 * `staff:manage` — a manager's list. Widening `staff` would have shown every removed
	 * employee to every rider on the platform's weakest role.
	 */
	affiliations: businessProcedure("staff:manage")
		.input(affiliationListInput)
		.query(({ ctx, input }) => affiliations.affiliations(ctx, input)),

	/**
	 * Invite somebody to join, without granting anything yet.
	 *
	 * The sibling of `inviteStaff` and the reason both exist: `inviteStaff` adds a person
	 * **immediately**, which is the right shape for a shop onboarding the two people who are
	 * standing next to the owner. This one asks first, and the difference is not cosmetic — a
	 * pending membership confers no capability, appears in no switcher, counts against no seat
	 * and draws no badge, so an invitation that is never answered costs the shop nothing but a
	 * row.
	 *
	 * Rate-limited on `inviteStaff`'s own budget and its own bucket: the two are the same kind
	 * of act against the same resource, and an email address is the thing a limiter on this
	 * path exists to keep from becoming an enumeration oracle. Separate buckets would double
	 * the attempts available to whoever was counting.
	 */
	inviteAffiliate: businessProcedure("staff:manage")
		.input(affiliationInviteInput)
		.mutation(async ({ ctx, input }) => {
			await rateLimit(
				ctx.env,
				"business:inviteStaff",
				ctx.user.id,
				INVITE_LIMIT,
				INVITE_WINDOW_SECONDS,
			);
			return affiliations.inviteAffiliate(ctx, {
				...input,
				businessId: ctx.membership.businessId,
			});
		}),

	/**
	 * Remove somebody, or withdraw an invitation. OWNER only, and a reason is required.
	 *
	 * `staff:manage` is the coarse gate and `assertRole` is the real one — the same shape as
	 * `removeStaff`, and for the same reason: `staff:manage` belongs to MANAGER, and deciding
	 * who no longer works here is not a manager's call in a product where a manager may
	 * themselves be removed by it.
	 *
	 * The reason is enforced in the service through `requireReason("affiliation.revoke", …)`,
	 * which is also what the console reads to decide whether to ask for one — one list, both
	 * sides of the wire.
	 */
	revokeAffiliation: businessProcedure("staff:manage")
		.input(affiliationRevokeInput)
		.mutation(({ ctx, input }) => {
			assertRole(ctx, "OWNER");
			return affiliations.revokeAffiliation(ctx, {
				...input,
				businessId: ctx.membership.businessId,
			});
		}),

	/**
	 * Staff invitations still use an existing account's email. Couriers do not: they use
	 * `couriers.invite`, which searches only reviewed, opted-in profiles and waits for the
	 * courier's acceptance. This procedure refuses COURIER rather than leaving two ways to
	 * grant the same role.
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
				timezone: z.literal(MARKET_TIME_ZONE),
				// The window decides the bars: an hours-wide read comes back bucketed
				// hourly, a month-spanning one monthly, so the client's plot gets one bar
				// per unit instead of ninety slivers. Every existing caller omits it and
				// keeps the day buckets the response has always carried.
				granularity: z.enum(["hour", "day", "month"]).default("day"),
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
