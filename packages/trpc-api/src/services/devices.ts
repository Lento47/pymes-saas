import { devicePushToken as tokenTable } from "@pymeshub/db";
import type {
	RegisterDeviceTokenInput,
	RevokeDeviceTokenInput,
} from "@pymeshub/shared";
import { and, eq } from "drizzle-orm";

import type { UserContext } from "./helpers";

export async function register(
	ctx: UserContext,
	input: RegisterDeviceTokenInput,
): Promise<{ ok: true }> {
	const now = new Date();
	await ctx.db
		.insert(tokenTable)
		.values({
			token: input.token,
			userId: ctx.user.id,
			platform: input.platform,
			createdAt: now,
			lastSeenAt: now,
		})
		.onConflictDoUpdate({
			target: tokenTable.token,
			set: {
				userId: ctx.user.id,
				platform: input.platform,
				lastSeenAt: now,
			},
		});
	return { ok: true };
}

export async function revoke(
	ctx: UserContext,
	input: RevokeDeviceTokenInput,
): Promise<{ ok: true }> {
	await ctx.db
		.delete(tokenTable)
		.where(
			and(
				eq(tokenTable.token, input.token),
				eq(tokenTable.userId, ctx.user.id),
			),
		);
	return { ok: true };
}

export async function revokeAll(ctx: UserContext): Promise<{ ok: true }> {
	await ctx.db.delete(tokenTable).where(eq(tokenTable.userId, ctx.user.id));
	return { ok: true };
}
