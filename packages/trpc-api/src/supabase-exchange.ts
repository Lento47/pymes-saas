import {
	account as accountTable,
	type Db,
	session as sessionTable,
	user as userTable,
} from "@pymeshub/db";
import { newId } from "@pymeshub/shared";
import { createContextClient, verifyAuth } from "@supabase/server/core";
import { and, eq, sql } from "drizzle-orm";

import type { Env } from "./env";
import { batchOf } from "./services/helpers";

/**
 * Supabase is a second way into the same marketplace identity.
 *
 * It is not a second authorisation system. A verified Supabase email is resolved to the
 * existing D1 `user` row (or creates that row on first use), a `supabase` row is recorded
 * in Better Auth's own `auth_account` table, and the exchange mints an ordinary
 * `auth_session` row. Every tRPC procedure, the live-order socket and sign-out therefore
 * keep using the same Better Auth context and the same D1 `membership` rows afterwards.
 */
const PROVIDER_ID = "supabase";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const MAX_TOKEN_LENGTH = 16_384;

type FailureStatus = 400 | 401 | 403 | 503;

type Failure = { ok: false; status: FailureStatus; code: string };
type Success = {
	ok: true;
	token: string;
	user: {
		id: string;
		name: string;
		email: string;
		image: string | null;
		phone: string | null;
	};
};

export type SupabaseExchangeResult = Failure | Success;

type SupabaseIdentity = {
	sub: string;
	email: string;
	name: string;
	image: string | null;
	phone: string | null;
};

type SupabaseConfig = {
	url: string;
	publishableKey: string;
	jwks: URL | undefined;
};

function fail(status: FailureStatus, code: string): Failure {
	return { ok: false, status, code };
}

function config(env: Env): SupabaseConfig | null {
	if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return null;

	let url: URL;
	try {
		url = new URL(env.SUPABASE_URL);
	} catch {
		return null;
	}
	if (url.protocol !== "https:") return null;

	let jwks: URL | undefined;
	if (env.SUPABASE_JWKS_URL) {
		try {
			jwks = new URL(env.SUPABASE_JWKS_URL);
		} catch {
			return null;
		}
		if (jwks.protocol !== "https:") return null;
	}

	return {
		url: env.SUPABASE_URL.replace(/\/+$/, ""),
		publishableKey: env.SUPABASE_PUBLISHABLE_KEY,
		jwks,
	};
}

function cleanText(value: unknown, max = 120): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed.slice(0, max) : null;
}

function metadataText(
	metadata: unknown,
	keys: readonly string[],
): string | null {
	if (typeof metadata !== "object" || metadata === null) return null;
	const record = metadata as Record<string, unknown>;
	for (const key of keys) {
		const value = cleanText(record[key]);
		if (value) return value;
	}
	return null;
}

type SupabaseUser = {
	id: string;
	email?: string | null;
	email_confirmed_at?: string | null;
	phone?: string | null;
	user_metadata?: unknown;
};

function identityOf(user: SupabaseUser): SupabaseIdentity | Failure {
	const email = cleanText(user.email)?.toLowerCase();
	if (!email) return fail(400, "email_required");
	// A Supabase session proves the JWT, not that the mailbox was confirmed. Only a
	// confirmed address is allowed to auto-link to a marketplace user; otherwise an
	// attacker could register somebody else's address and claim their account.
	if (!user.email_confirmed_at) return fail(403, "email_not_confirmed");

	const name =
		metadataText(user.user_metadata, ["full_name", "name", "display_name"]) ??
		email.split("@")[0] ??
		"";
	return {
		sub: user.id,
		email,
		name,
		image: metadataText(user.user_metadata, [
			"avatar_url",
			"picture",
			"image_url",
		]),
		phone: cleanText(user.phone, 40),
	};
}

async function verifyIdentity(
	accessToken: string,
	env: Env,
): Promise<SupabaseIdentity | Failure> {
	const supabase = config(env);
	if (!supabase) return fail(503, "supabase_not_configured");

	const verified = await verifyAuth(
		new Request("https://supabase.invalid/", {
			headers: { authorization: `Bearer ${accessToken}` },
		}),
		{
			auth: "user",
			env: { url: supabase.url, jwks: supabase.jwks },
			issuer: `${supabase.url}/auth/v1`,
			audience: "authenticated",
		},
	);
	if (verified.error) {
		return fail(verified.error.status >= 500 ? 503 : 401, "invalid_token");
	}

	const token = verified.data.token;
	if (!token) return fail(401, "invalid_token");

	try {
		const client = createContextClient({
			auth: { token },
			env: {
				url: supabase.url,
				publishableKeys: { default: supabase.publishableKey },
				jwks: supabase.jwks,
			},
		});
		const result = await client.auth.getUser();
		if (result.error || !result.data.user) {
			return fail(503, "supabase_user_lookup_failed");
		}
		return identityOf(result.data.user as SupabaseUser);
	} catch {
		return fail(503, "supabase_user_lookup_failed");
	}
}

async function linkedUser(db: Db, sub: string) {
	const links = await db
		.select({ userId: accountTable.userId })
		.from(accountTable)
		.where(
			and(
				eq(accountTable.providerId, PROVIDER_ID),
				eq(accountTable.accountId, sub),
			),
		)
		.limit(1);
	if (!links[0]) return null;

	const rows = await db
		.select()
		.from(userTable)
		.where(eq(userTable.id, links[0].userId))
		.limit(1);
	if (!rows[0]) throw new Error("Supabase identity points at a missing user");
	return rows[0];
}

async function userByEmail(db: Db, email: string) {
	const rows = await db
		.select()
		.from(userTable)
		.where(sql`lower(${userTable.email}) = ${email}`)
		.limit(1);
	return rows[0] ?? null;
}

async function userById(db: Db, id: string) {
	const rows = await db
		.select()
		.from(userTable)
		.where(eq(userTable.id, id))
		.limit(1);
	return rows[0] ?? null;
}

async function linkAccount(
	db: Db,
	identity: SupabaseIdentity,
	userId: string,
): Promise<void> {
	await db
		.insert(accountTable)
		.values({
			id: newId("account"),
			accountId: identity.sub,
			providerId: PROVIDER_ID,
			userId,
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.onConflictDoNothing();
}

function profileOf(user: typeof userTable.$inferSelect) {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		image: user.image,
		phone: user.phone,
	};
}

async function resolveIdentity(db: Db, identity: SupabaseIdentity) {
	const existingLink = await linkedUser(db, identity.sub);
	if (existingLink) return profileOf(existingLink);

	const existingUser = await userByEmail(db, identity.email);
	if (existingUser) {
		await linkAccount(db, identity, existingUser.id);
		return profileOf((await linkedUser(db, identity.sub)) ?? existingUser);
	}

	const now = new Date();
	const userId = newId("user");
	try {
		await db.batch(
			batchOf([
				db.insert(userTable).values({
					id: userId,
					name: identity.name,
					email: identity.email,
					emailVerified: true,
					image: identity.image,
					phone: identity.phone,
					isAdmin: false,
					suspendedAt: null,
					createdAt: now,
					updatedAt: now,
				}),
				db.insert(accountTable).values({
					id: newId("account"),
					accountId: identity.sub,
					providerId: PROVIDER_ID,
					userId,
					createdAt: now,
					updatedAt: now,
				}),
			]),
		);
	} catch (error) {
		// A concurrent first exchange may have won either unique index. Adopt its row
		// instead of creating a second marketplace identity for the same person.
		const racedLink = await linkedUser(db, identity.sub);
		if (racedLink) return profileOf(racedLink);
		const racedUser = await userByEmail(db, identity.email);
		if (racedUser) {
			await linkAccount(db, identity, racedUser.id);
			return profileOf(racedUser);
		}
		throw error;
	}

	const created = await userById(db, userId);
	if (!created) throw new Error("Supabase user creation returned no row");
	return profileOf(created);
}

async function mintSession(db: Db, userId: string): Promise<string> {
	const now = new Date();
	const token = `pymeshub_${crypto.randomUUID().replace(/-/g, "")}`;
	await db.insert(sessionTable).values({
		id: newId("session"),
		token,
		userId,
		expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
		createdAt: now,
		updatedAt: now,
		ipAddress: null,
		userAgent: null,
	});
	return token;
}

/** Verify a Supabase access token and return a normal marketplace bearer token. */
export async function exchangeSupabaseSession(
	accessToken: unknown,
	env: Env,
	db: Db,
): Promise<SupabaseExchangeResult> {
	if (
		typeof accessToken !== "string" ||
		accessToken.length === 0 ||
		accessToken.length > MAX_TOKEN_LENGTH
	) {
		return fail(400, "invalid_request");
	}

	const identity = await verifyIdentity(accessToken, env);
	if (!("sub" in identity)) return identity;

	const user = await resolveIdentity(db, identity);
	if (!user) return fail(503, "user_resolution_failed");
	return { ok: true, token: await mintSession(db, user.id), user };
}

export function supabaseConfigured(env: Env): boolean {
	return config(env) !== null;
}
