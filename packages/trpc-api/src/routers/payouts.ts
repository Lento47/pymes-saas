import { z } from "zod";

import * as businesses from "../services/businesses";
import { businessProcedure, router } from "../trpc";

/**
 * The business's payout runs. OWNER, via `payouts:read` — the only capability a MANAGER
 * does not hold, because the run is the business's money leaving the platform and the
 * person who owns the account is the one who reconciles it.
 *
 * The list is read-only: moving money is not this system's job yet, and the admin side is
 * where a payout is marked paid.
 */
export const payoutsRouter = router({
	list: businessProcedure("payouts:read")
		.input(z.object({ businessId: z.string() }))
		.query(({ ctx }) =>
			businesses.listPayouts(ctx, { businessId: ctx.membership.businessId }),
		),
});
