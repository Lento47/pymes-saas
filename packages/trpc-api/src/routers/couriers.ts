import {
	courierBusinessInvitesInput,
	courierCancelInviteInput,
	courierDirectoryInput,
	courierInviteInput,
	courierProfileInput,
	courierRespondInput,
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

	saveProfile: protectedProcedure
		.input(courierProfileInput)
		.mutation(({ ctx, input }) => couriers.saveProfile(ctx, input)),

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
