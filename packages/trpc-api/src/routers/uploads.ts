import { uploadImageInput } from "@pymeshub/shared";

import { rateLimit } from "../context";
import * as uploads from "../services/uploads";
import { protectedProcedure, router } from "../trpc";

/**
 * The image pipeline's one procedure.
 *
 * Base64 in a mutation, not multipart: the native client's tRPC connection
 * already carries the session's bearer token, and a `FormData` body would need
 * a second auth story for a single endpoint. The rate limit is generous for a
 * person and tight for anything scripted - thirty pictures an hour is far past
 * what filling a profile needs and short of what a bucket bill notices.
 */
const IMAGE_LIMIT = 30;
const IMAGE_WINDOW_SECONDS = 60 * 60;

export const uploadsRouter = router({
	image: protectedProcedure
		.input(uploadImageInput)
		.mutation(async ({ ctx, input }) => {
			await rateLimit(
				ctx.env,
				"uploads:image",
				ctx.user.id,
				IMAGE_LIMIT,
				IMAGE_WINDOW_SECONDS,
			);
			return uploads.putImage(ctx, input);
		}),
});
