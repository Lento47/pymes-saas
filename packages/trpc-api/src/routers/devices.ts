import {
	registerDeviceTokenInput,
	revokeDeviceTokenInput,
} from "@pymeshub/shared";

import * as devices from "../services/devices";
import { protectedProcedure, router } from "../trpc";

export const devicesRouter = router({
	register: protectedProcedure
		.input(registerDeviceTokenInput)
		.mutation(({ ctx, input }) => devices.register(ctx, input)),
	revoke: protectedProcedure
		.input(revokeDeviceTokenInput)
		.mutation(({ ctx, input }) => devices.revoke(ctx, input)),
	revokeAll: protectedProcedure.mutation(({ ctx }) => devices.revokeAll(ctx)),
});
