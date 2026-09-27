import { courierProfileInput } from "@pymeshub/shared";

import * as couriers from "../services/couriers";
import { protectedProcedure, router } from "../trpc";

/**
 * The courier's own profile: read it, write it, nothing else.
 *
 * The procedures a *business* uses to find a courier (directory, invite) and
 * the ones a courier uses to answer one belong to the trust extension and are
 * deliberately not here - a router that exists is a router a client can call,
 * and half of that flow without its review side would be a directory that
 * lists people the platform never approved.
 *
 * Both procedures are `protectedProcedure` rather than anything role-gated:
 * the profile is an identity a person opts into *before* any membership
 * exists, so requiring a `COURIER` row here would make the first profile
 * impossible.
 */
export const couriersRouter = router({
	profile: protectedProcedure.query(({ ctx }) => couriers.myProfile(ctx)),

	saveProfile: protectedProcedure
		.input(courierProfileInput)
		.mutation(({ ctx, input }) => couriers.saveProfile(ctx, input)),
});
