import {
	mobileDraftInput,
	mobilePublishInput,
	mobileRestoreInput,
	mobilePreviewInput,
	mobileDestinationSearchInput,
} from "@pymeshub/shared";
import { z } from "zod";
import * as mobile from "../services/mobile-configuration";
import { adminProcedure, publicProcedure, router } from "../trpc";

export const mobileRouter = router({
	destinations: adminProcedure.input(mobileDestinationSearchInput).query(({ ctx, input }) => mobile.destinationOptions(ctx, input)),
	preview: adminProcedure.input(mobilePreviewInput).query(({ ctx, input }) => mobile.preview(ctx, input)),
	published: publicProcedure.query(({ ctx }) => mobile.published(ctx)),
	draft: adminProcedure.query(({ ctx }) => mobile.readDraft(ctx)),
	saveDraft: adminProcedure
		.input(mobileDraftInput)
		.mutation(({ ctx, input }) => mobile.saveDraft(ctx, input)),
	discardDraft: adminProcedure
		.input(mobilePublishInput.pick({ expectedVersion: true }))
		.mutation(({ ctx, input }) => mobile.discardDraft(ctx, input)),
	publish: adminProcedure
		.input(mobilePublishInput)
		.mutation(({ ctx, input }) => mobile.publishDraft(ctx, input)),
	restore: adminProcedure
		.input(mobileRestoreInput)
		.mutation(({ ctx, input }) => mobile.restore(ctx, input)),
	history: adminProcedure
		.input(z.object({ before: z.number().int().positive().optional() }))
		.query(({ ctx, input }) => mobile.history(ctx, input)),
});
