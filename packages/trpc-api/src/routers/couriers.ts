import {
	courierBusinessInvitesInput,
	courierCancelInviteInput,
	courierDirectoryInput,
	courierInviteInput,
	courierProfileInput,
	courierRespondInput,
	courierZoneInput,
} from "@pymeshub/shared";

import { rateLimit } from "../context";
import * as couriers from "../services/couriers";
import { businessProcedure, protectedProcedure, router } from "../trpc";

const DIRECTORY_LIMIT = 30;
const DIRECTORY_WINDOW_SECONDS = 60;
const INVITE_LIMIT = 5;
const INVITE_WINDOW_SECONDS = 60 * 60;

export const couriersRouter = router({
	profile: protectedProcedure.query(({ ctx }) => couriers.myProfile(ctx)),

	/**
	 * What this courier has delivered and what customers rated them.
	 *
	 * **`protectedProcedure`, not a role gate**, for the same reason `profile` is: a courier's
	 * first run is possible before any profile row exists, and refusing the numbers to somebody
	 * whose history exists would be backwards.
	 *
	 * **No rate limit, deliberately.** `directory` and `invite` are limited because they expose
	 * *other people's* rows and one of them writes. This reads only the caller's own totals, is
	 * two `COUNT(*)`s over indexed columns, and changes when a delivery is completed — so the
	 * limiter would be guarding a number against the person it belongs to.
	 */
	stats: protectedProcedure.query(({ ctx }) => couriers.stats(ctx)),

	saveProfile: protectedProcedure
		.input(courierProfileInput)
		.mutation(({ ctx, input }) => couriers.saveProfile(ctx, input)),
	saveZone: protectedProcedure
		.input(courierZoneInput)
		.mutation(({ ctx, input }) => couriers.saveZone(ctx, input)),

	directory: businessProcedure("staff:manage")
		.input(courierDirectoryInput)
		.query(async ({ ctx, input }) => {
			await rateLimit(
				ctx.env,
				"courier:directory",
				ctx.user.id,
				DIRECTORY_LIMIT,
				DIRECTORY_WINDOW_SECONDS,
			);
			return couriers.directory(ctx, input);
		}),

	invite: businessProcedure("staff:manage")
		.input(courierInviteInput)
		.mutation(async ({ ctx, input }) => {
			await rateLimit(
				ctx.env,
				"courier:invite",
				ctx.user.id,
				INVITE_LIMIT,
				INVITE_WINDOW_SECONDS,
			);
			return couriers.invite(ctx, input);
		}),

	myInvites: protectedProcedure.query(({ ctx }) => couriers.myInvites(ctx)),

	respond: protectedProcedure
		.input(courierRespondInput)
		.mutation(({ ctx, input }) => couriers.respond(ctx, input)),

	pendingForBusiness: businessProcedure("staff:manage")
		.input(courierBusinessInvitesInput)
		.query(({ ctx, input }) => couriers.businessInvites(ctx, input)),

	cancelInvite: businessProcedure("staff:manage")
		.input(courierCancelInviteInput)
		.mutation(({ ctx, input }) => couriers.cancel(ctx, input)),
});
