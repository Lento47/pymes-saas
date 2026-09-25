import {
	acceptDeliveryOfferInput,
	advanceDeliveryInput,
	courierPresenceInput,
	declineDeliveryOfferInput,
	deliveryByIdInput,
	deliveryByOrderInput,
	rateDeliveryInput,
} from "@pymeshub/shared";

import * as deliveries from "../services/deliveries";
import { protectedProcedure, router } from "../trpc";

export const deliveriesRouter = router({
	reportPresence: protectedProcedure
		.input(courierPresenceInput)
		.mutation(({ ctx, input }) => deliveries.reportPresence(ctx, input)),

	offers: protectedProcedure.query(({ ctx }) => deliveries.offers(ctx)),

	acceptOffer: protectedProcedure
		.input(acceptDeliveryOfferInput)
		.mutation(({ ctx, input }) => deliveries.acceptOffer(ctx, input)),

	declineOffer: protectedProcedure
		.input(declineDeliveryOfferInput)
		.mutation(({ ctx, input }) => deliveries.declineOffer(ctx, input)),

	mine: protectedProcedure.query(({ ctx }) => deliveries.mine(ctx)),

	byId: protectedProcedure
		.input(deliveryByIdInput)
		.query(({ ctx, input }) => deliveries.byId(ctx, input)),

	byOrder: protectedProcedure
		.input(deliveryByOrderInput)
		.query(({ ctx, input }) => deliveries.byOrder(ctx, input)),

	advance: protectedProcedure
		.input(advanceDeliveryInput)
		.mutation(({ ctx, input }) => deliveries.advance(ctx, input)),

	rate: protectedProcedure
		.input(rateDeliveryInput)
		.mutation(({ ctx, input }) => deliveries.rate(ctx, input)),
});
