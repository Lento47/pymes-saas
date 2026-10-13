import {
	ideaCreateInput,
	ideaGetInput,
	ideaListInput,
	ideaListMineInput,
	ideaResolveInput,
} from "@pymeshub/shared";

import { rateLimit } from "../context";
import { NotFoundError } from "../errors";
import * as idea from "../services/idea";
import { adminProcedure, protectedProcedure, router } from "../trpc";

/**
 * Ideas, as a queue an operator works.
 *
 * ## Why `protectedProcedure` and not `businessProcedure`
 *
 * Every merchant route in this Worker is `businessProcedure(...)`, which turns a
 * `businessId` in the input into a checked membership before the body runs. An idea
 * has no such tenant to check: a customer with no shop can send one, and that is
 * the majority case.
 *
 * So `create` is a signed-in write with no business involved, the same asymmetry
 * `crashReport.report` has, and the reason this is its own file rather than three
 * lines in `routers/support.ts`.
 */

const CREATE_LIMIT = 5;
const CREATE_WINDOW_SECONDS = 60 * 60;

export const ideaRouter = router({
	create: protectedProcedure
		.input(ideaCreateInput)
		.mutation(async ({ ctx, input }) => {
			await rateLimit(
				ctx.env,
				"idea:create",
				ctx.user.id,
				CREATE_LIMIT,
				CREATE_WINDOW_SECONDS,
			);
			return idea.create(ctx, input);
		}),

	listMine: protectedProcedure
		.input(ideaListMineInput)
		.query(({ ctx, input }) => idea.listMine(ctx, input)),

	list: adminProcedure
		.input(ideaListInput)
		.query(({ ctx, input }) => idea.list(ctx, input)),

	get: adminProcedure.input(ideaGetInput).query(async ({ ctx, input }) => {
		const row = await idea.get(ctx, input.id);
		if (!row) throw new NotFoundError("Idea no encontrada");
		return row;
	}),

	resolve: adminProcedure
		.input(ideaResolveInput)
		.mutation(({ ctx, input }) => idea.resolve(ctx, input)),
});
