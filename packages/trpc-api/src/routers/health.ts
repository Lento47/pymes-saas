import { sql } from "drizzle-orm";

import { publicProcedure, router } from "../trpc";

/**
 * The deploy smoke test, and the only unauthenticated procedure besides the public
 * catalogue.
 *
 * `db` is a real round trip to D1 rather than a constant: a Worker that boots and cannot
 * reach its database is the failure this endpoint exists to catch, and a health check that
 * answers `ok` from memory is a health check that reports a broken deploy as a good one.
 * The failure is reported as a value, not thrown — a 500 from `/health` reads as the
 * health endpoint being down rather than as the database being down.
 */
export const healthRouter = router({
	check: publicProcedure.query(async ({ ctx }) => {
		let db: "ok" | "unreachable" = "ok";

		try {
			await ctx.db.run(sql`select 1`);
		} catch (error) {
			db = "unreachable";
			// The name only: a D1 error message quotes the statement that failed.
			ctx.logger.error("La base de datos no responde", {
				reason: error instanceof Error ? error.name : "unknown",
			});
		}

		return {
			ok: db === "ok",
			version: ctx.env.API_VERSION,
			db,
		};
	}),
});
