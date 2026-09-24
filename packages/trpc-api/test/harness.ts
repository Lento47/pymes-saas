/// <reference types="bun" />

import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { AuthenticatedUser } from "@pymeshub/auth";
import {
	business as businessTable,
	category as categoryTable,
	createDb,
	type Db,
	merchantLocation as locationTable,
	membership as membershipTable,
	productOptionGroup as optionGroupTable,
	productOption as optionTable,
	order as orderTable,
	product as productTable,
	review as reviewTable,
	session as sessionTable,
	user as userTable,
} from "@pymeshub/db";
import { newOrderReference } from "@pymeshub/shared";
import { eq } from "drizzle-orm";

import type { Context, Membership, MirrorUser } from "../src/context";
import type { Env } from "../src/env";
import { DomainError } from "../src/errors";
import { createLogger } from "../src/logging";

/**
 * A real database, and the reasons it is this one.
 *
 * These specs need D1's actual semantics, not a mock of them: the order state machine is
 * enforced by a unique index and a conditional update, idempotency is enforced by a unique
 * index on `dedupe_key`, and the one-business cart rule is enforced by a read and a write in
 * the same batch. A hand-rolled fake that "returns what the test wants" would assert that
 * the test agrees with itself.
 *
 * So: `bun:sqlite` running the committed migration, behind a small object that answers the
 * `D1Database` calls the production `drizzle-orm/d1` driver makes. The driver, the query
 * builder, the schema and every service are the production ones — only the `ORDER_ROOM`
 * binding is substituted, by a stub that records what was published to it instead of
 * waking a Durable Object (`test.sent` below). What that does **not** give is workerd's D1: statement-level constraints are
 * the same (it is SQLite either way), but D1's own batch semantics, its 100-statement limit
 * and its error wording are not exercised here. That limit is in the handover report.
 */

// A path, not a `URL`: the two `URL` types in scope (Bun's and Node's) do not overlap, and
// `readFileSync` in this repo's `types` resolves to Node's. One `join` is cheaper than a cast.
const MIGRATIONS_DIR = join(import.meta.dir, "../../../packages/db/migrations");

/**
 * Every migration, in the order the journal lists them.
 *
 * This used to name `0000_init.sql` outright, which meant the schema a spec ran against was
 * frozen at the day that file was written: a later migration could add a table or a column
 * and the tests would keep passing against a database that no longer exists anywhere. The
 * failure mode is the worst kind — green, and about something else.
 *
 * Read from the directory rather than from `meta/_journal.json` because the filenames are
 * already ordered by their `000N_` prefix, which is the same convention the journal's tags
 * follow; there is no second source of truth to drift.
 */
function migrationFiles(): string[] {
	return readdirSync(MIGRATIONS_DIR)
		.filter((name) => name.endsWith(".sql"))
		.sort();
}

/** SQLite has no boolean and no `undefined`: the driver emits either. */
function toBindable(value: unknown): unknown {
	if (value === undefined) return null;
	if (typeof value === "boolean") return value ? 1 : 0;
	if (value instanceof Date) return value.getTime();
	return value;
}

class Statement {
	#db: Database;
	#sql: string;
	#params: unknown[];

	constructor(db: Database, sql: string, params: unknown[] = []) {
		this.#db = db;
		this.#sql = sql;
		this.#params = params;
	}

	bind(...params: unknown[]): Statement {
		return new Statement(this.#db, this.#sql, params);
	}

	#params_(): never[] {
		return this.#params.map(toBindable) as never[];
	}

	async all(): Promise<D1Result> {
		return {
			results: this.#db.prepare(this.#sql).all(...this.#params_()),
			success: true,
			meta: {},
		} as D1Result;
	}

	/**
	 * Rows as arrays, and this method is the reason the shim exists at all.
	 *
	 * drizzle reads a result set positionally — `mapResultRow` walks the query's fields and
	 * indexes the row by *column number*. Handing it objects is silently wrong the moment
	 * two joined tables share a column name (`product.id` and `business.id`), because
	 * `Object.keys` collapses the duplicate and every field after it shifts by one. That
	 * failure does not look like a mapping bug: it looks like `JSON.parse(undefined)` from
	 * whichever json column happened to land on the wrong index.
	 */
	async raw(): Promise<unknown[][]> {
		return this.#db.prepare(this.#sql).values(...this.#params_());
	}

	async first(column?: string): Promise<unknown> {
		const row = this.#db.prepare(this.#sql).get(...this.#params_()) as
			| Record<string, unknown>
			| undefined
			| null;
		if (!row) return null;
		return column ? (row[column] ?? null) : row;
	}

	async run(): Promise<D1Result> {
		const statement = this.#db.prepare(this.#sql);
		// A `returning` clause is read back through `results` — drizzle's batch mapping takes
		// the rows from there — and the idempotency claim in `orders.place` is built on
		// exactly that: an empty result is how the loser of the race knows it lost.
		if (/\breturning\b/i.test(this.#sql)) {
			return {
				results: statement.all(...this.#params_()),
				success: true,
				meta: {},
			} as D1Result;
		}

		const result = statement.run(...this.#params_());
		// `changes` is filled in because a compare-and-set can read it, and an empty `meta`
		// would report "no rows matched" for every write that ever matched — a test that
		// passes while asserting the opposite of what happened. The rest of `D1Meta` is what
		// only a real D1 can say (`duration`, `rows_read`, `served_by`), so it stays absent.
		return {
			results: [],
			success: true,
			meta: {
				changes: result.changes,
				last_row_id: Number(result.lastInsertRowid),
			},
		} as unknown as D1Result;
	}
}

/** The `D1Database` surface the drizzle D1 driver actually touches. */
export function d1Over(sqlite: Database): D1Database {
	const shim = {
		prepare: (sql: string) => new Statement(sqlite, sql),
		batch: async (statements: Statement[]) => {
			const results: D1Result[] = [];
			// D1 rejects an explicit transaction, and `batch` is atomic instead. SQLite here
			// can do a real one, and doing it makes the atomicity the services rely on true
			// in the test as well.
			sqlite.exec("begin");
			try {
				for (const statement of statements) results.push(await statement.run());
				sqlite.exec("commit");
			} catch (error) {
				sqlite.exec("rollback");
				throw error;
			}
			return results;
		},
		exec: async (sql: string) => {
			sqlite.exec(sql);
			return { count: 0, duration: 0 } as D1ExecResult;
		},
		dump: async () => new ArrayBuffer(0),
	};
	return shim as unknown as D1Database;
}

/**
 * A KV stand-in. Counters and cache keys only — nothing in the API treats a KV value as
 * the source of truth, so a `Map` is a faithful stand-in for this test's purposes.
 */
function kv(): KVNamespace {
	const store = new Map<string, string>();
	return {
		get: async (key: string) => store.get(key) ?? null,
		put: async (key: string, value: string) => {
			store.set(key, value);
		},
		delete: async (key: string) => {
			store.delete(key);
		},
		list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
	} as unknown as KVNamespace;
}

/**
 * One message the API handed to the queue.
 *
 * `type` is lifted from the envelope's `eventType` and `eventId` kept alongside, because
 * the two questions a spec asks of this list are "was the shop told?" (type) and "was the
 * *same event* told twice?" (eventId) — and the second is the one that used to be
 * unanswerable, since the old messages carried no id at all.
 */
export type SentEvent = { type: string; eventId: string | null; body: unknown };

export type TestWorld = {
	sqlite: Database;
	db: Db;
	env: Env;
	/** Everything the API enqueued, in order, so a test can prove an event was announced. */
	sent: SentEvent[];
	/** Every publish the API made to an order's Durable Object. */
	published: unknown[];
	close: () => void;
};

/**
 * The world one spec runs in: a migrated database, an `Env` with the bindings the services
 * touch, and a recorded queue.
 */
export function world(): TestWorld {
	const sqlite = new Database(":memory:");
	sqlite.exec("pragma foreign_keys = on");

	for (const file of migrationFiles()) {
		const ddl = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
		for (const statement of ddl.split("--> statement-breakpoint")) {
			const trimmed = statement.trim();
			if (trimmed) sqlite.exec(trimmed);
		}
	}

	const sent: SentEvent[] = [];
	const published: unknown[] = [];

	const env = {
		DB: d1Over(sqlite),
		CACHE: kv(),
		ORDER_EVENTS: {
			send: async (body: unknown) => {
				const envelope = body as { eventId?: string; eventType?: string };
				sent.push({
					type: envelope?.eventType ?? "unknown",
					eventId: envelope?.eventId ?? null,
					body,
				});
			},
		},
		ORDER_ROOM: {
			idFromName: (name: string) => name,
			// The DO itself is not exercised: it is a WebSocket fan-out, and what the API
			// promises a test is that it *published*, which is the `published` array.
			get: () => ({
				publish: async (event: unknown) => {
					published.push(event);
				},
				fetch: async () => new Response(null, { status: 200 }),
			}),
		},
		ENVIRONMENT: "test",
		API_VERSION: "test",
	} as unknown as Env;

	return {
		sqlite,
		db: createDb(env.DB),
		env,
		sent,
		published,
		close: () => sqlite.close(),
	};
}

/** A user row plus the `MirrorUser` the context carries, in one call. */
export async function seedUser(
	db: Db,
	overrides: Partial<MirrorUser> & { id?: string } = {},
): Promise<MirrorUser> {
	const id = overrides.id ?? "usr_test_customer";
	const now = new Date();
	await db.insert(userTable).values({
		id,
		email: overrides.email ?? `${id}@example.test`,
		name: overrides.name ?? "Cliente de Prueba",
		image: overrides.image ?? null,
		phone: overrides.phone ?? null,
		isAdmin: overrides.isAdmin ?? false,
		suspendedAt: overrides.suspendedAt ?? null,
		emailVerified: true,
		createdAt: now,
		updatedAt: now,
	});

	return {
		id,
		name: overrides.name ?? "Cliente de Prueba",
		email: overrides.email ?? `${id}@example.test`,
		image: overrides.image ?? null,
		phone: overrides.phone ?? null,
		isAdmin: overrides.isAdmin ?? false,
		suspendedAt: overrides.suspendedAt ?? null,
	};
}

/**
 * A session the real Better Auth will accept, written the way Better Auth writes one.
 *
 * This is not a mock of a session and it is not a shortcut around the verifier. It is one
 * `insert` into `auth_session`, and everything downstream of it is production: the bearer
 * plugin reads the `Authorization` header, signs the token into the `pymeshub.session_token`
 * cookie with the server's secret, `sessionMiddleware` unsigns it and asks the adapter for
 * the row by token, and the adapter joins `user` the same way it does in a Worker. A test
 * that seeds this row and calls `createContext` has therefore exercised the whole identity
 * path — HMAC, cookie signing, the adapter's join — and not a stub of it.
 *
 * What it deliberately does *not* do is go through `signUpEmail`. Minting a session by
 * password would drag the `auth_account` row, the password hash and the sign-up rate limit
 * into every spec that only wants to know what a *signed-in* caller may do — and it is the
 * token→session→user→membership chain that decides that, not how the token was issued.
 *
 * The token is stored raw, because that is what Better Auth stores: `createSession` in
 * `better-auth@1.7.5` assigns `token: generateId(32)` and `findSession` looks that value up
 * directly. If a future version starts hashing at rest, this helper is the one line that
 * changes — and the specs that use it will fail loudly rather than quietly passing.
 */
export async function seedSession(
	db: Db,
	userId: string,
	overrides: { id?: string; token?: string; expiresAt?: Date } = {},
): Promise<string> {
	const now = new Date();
	const token = overrides.token ?? `tok_test_${userId}`;
	await db.insert(sessionTable).values({
		id: overrides.id ?? `ses_test_${userId}`,
		token,
		userId,
		expiresAt:
			overrides.expiresAt ?? new Date(now.getTime() + 7 * 24 * 60 * 60_000),
		createdAt: now,
		updatedAt: now,
		ipAddress: "",
		userAgent: "",
	});
	return token;
}

export async function seedMembership(
	db: Db,
	userId: string,
	businessId: string,
	role: Membership["role"],
): Promise<void> {
	await db.insert(membershipTable).values({
		id: `mem_test_${userId}_${businessId}`,
		businessId,
		userId,
		role,
		createdAt: new Date(),
	});
}

export async function seedBusiness(
	db: Db,
	overrides: {
		id?: string;
		slug?: string;
		name?: string;
		/**
		 * `DRAFT` and `SUSPENDED` exist so a spec can assert that a shop the platform has
		 * not opened or has closed is invisible to the marketplace — and still visible to
		 * the people who work there. `ACTIVE` is the default because a spec that has to
		 * think about visibility is the exception.
		 */
		status?: "DRAFT" | "ACTIVE" | "CLOSED" | "SUSPENDED";
	} = {},
): Promise<string> {
	const id = overrides.id ?? "biz_test_shop";
	await db.insert(businessTable).values({
		id,
		slug: overrides.slug ?? `tienda-${id}`,
		name: overrides.name ?? "Tienda de Prueba",
		currency: "CRC",
		status: overrides.status ?? "ACTIVE",
		deliveryEnabled: true,
		pickupEnabled: true,
		deliveryFeeMinor: 0,
		deliveryRadiusKm: 6,
		prepTimeMinutes: 25,
		minOrderMinor: 0,
		ratingCount: 0,
		ratingAvg: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
	});
	await db.insert(locationTable).values({
		id: `loc_${id}`,
		businessId: id,
		name: overrides.name ?? "Tienda de Prueba",
		isDefault: true,
		createdAt: new Date(),
		updatedAt: new Date(),
	});
	return id;
}

export async function seedCategory(db: Db, id = "cat_test"): Promise<string> {
	await db.insert(categoryTable).values({
		id,
		slug: `categoria-${id}`,
		name: "Categoría de Prueba",
		sortOrder: 0,
	});
	return id;
}

export type SeededProduct = {
	id: string;
	priceMinor: number;
	optionId: string | null;
};

/**
 * A product, priced, with one option group and one option when asked for one.
 *
 * The option's `priceDeltaMinor` is not decoration: the place-order total has to be the
 * product's price *plus* the options the customer picked, and a product seeded without an
 * option could not show that.
 */
export async function seedProduct(
	db: Db,
	input: {
		id?: string;
		businessId: string;
		name?: string;
		priceMinor?: number;
		optionDeltaMinor?: number;
		stockQuantity?: number;
		trackInventory?: boolean;
		categoryId?: string | null;
		status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
		prepTimeMinutes?: number | null;
	} = { businessId: "biz_test_shop" },
): Promise<SeededProduct> {
	const id = input.id ?? "prd_test_item";
	const priceMinor = input.priceMinor ?? 1500;
	const now = new Date();

	await db.insert(productTable).values({
		id,
		businessId: input.businessId,
		name: input.name ?? "Producto de Prueba",
		priceMinor,
		currency: "CRC",
		status: input.status ?? "ACTIVE",
		categoryId: input.categoryId ?? null,
		isFeatured: false,
		trackInventory: input.trackInventory ?? false,
		stockQuantity: input.stockQuantity ?? 0,
		prepTimeMinutes:
			input.prepTimeMinutes === undefined ? 10 : input.prepTimeMinutes,
		createdAt: now,
		updatedAt: now,
	});

	let optionId: string | null = null;
	if (input.optionDeltaMinor !== undefined) {
		const groupId = `ogp_test_${id}`;
		optionId = `opt_test_${id}`;
		await db.insert(optionGroupTable).values({
			id: groupId,
			productId: id,
			name: "Extras",
			kind: "SINGLE",
			isRequired: false,
			minSelect: 0,
			maxSelect: 1,
			sortOrder: 0,
		});
		await db.insert(optionTable).values({
			id: optionId,
			groupId,
			name: "Extra",
			priceDeltaMinor: input.optionDeltaMinor,
			isAvailable: true,
			sortOrder: 0,
		});
	}

	return { id, priceMinor, optionId };
}

/**
 * A review, with the order it was written about.
 *
 * The order is not decoration: `review.order_id` is `not null`, uniquely indexed and a
 * foreign key, so a review cannot exist without the order it came from — and the order is
 * seeded minimally on purpose, because no review read joins it. A fixture that filled every
 * column would be asserting the order's shape rather than the read it is standing up.
 *
 * `createdAt` is a parameter rather than "now" because the cursor a review list pages on is
 * the `(createdAt, id)` tuple, and a spec that wants a tie has to be able to write one.
 */
export async function seedReview(
	db: Db,
	input: {
		id?: string;
		businessId: string;
		customerId: string;
		rating?: number;
		comment?: string | null;
		createdAt?: Date;
	},
): Promise<{ id: string; orderId: string }> {
	const id = input.id ?? `rev_test_${crypto.randomUUID()}`;
	const orderId = `ord_test_${id}`;
	const now = new Date();
	const placedAt = input.createdAt ?? now;

	await db.insert(orderTable).values({
		id: orderId,
		reference: newOrderReference(),
		customerId: input.customerId,
		businessId: input.businessId,
		fulfilment: "PICKUP",
		status: "COMPLETED",
		paymentMethod: "CASH",
		currency: "CRC",
		subtotalMinor: 1500,
		totalMinor: 1500,
		placedAt,
		createdAt: placedAt,
		updatedAt: placedAt,
	});

	await db.insert(reviewTable).values({
		id,
		orderId,
		businessId: input.businessId,
		customerId: input.customerId,
		productId: null,
		rating: input.rating ?? 5,
		comment: input.comment ?? null,
		createdAt: placedAt,
	});

	return { id, orderId };
}

/**
 * A context for one caller.
 *
 * `memberships` is loaded from the `membership` table rather than handed in, because that
 * is what `createContext` does — and because it is what makes the permission specs real: a
 * caller with no row for a business genuinely has no membership, so `businessProcedure`
 * refuses them through its own code path and not through a stub.
 *
 * The production loader is not exported, so this mirrors its one select. If a membership
 * ever means more than `(businessId, role)`, this is the line that has to change with it.
 */
export async function contextFor(
	test: TestWorld,
	user: MirrorUser | null,
	overrides: { memberships?: Membership[] } = {},
): Promise<Context> {
	const memberships =
		overrides.memberships ??
		(user
			? (
					await test.db
						.select({
							businessId: membershipTable.businessId,
							role: membershipTable.role,
						})
						.from(membershipTable)
						.where(eq(membershipTable.userId, user.id))
				).map((row) => ({
					businessId: row.businessId,
					role: row.role as Membership["role"],
				}))
			: []);

	return {
		env: test.env,
		db: test.db,
		logger: createLogger({ requestId: "test", environment: "test" }),
		requestId: "test",
		auth: user
			? ({ id: user.id, email: user.email } as AuthenticatedUser)
			: null,
		user,
		memberships,
		client: "web",
	};
}

/**
 * A caller that is signed in, for `contextFor` — the shape `protectedProcedure` narrows to.
 * Kept separate so a spec that wants an anonymous caller can pass `null` and read the
 * `UNAUTHORIZED` the middleware produces.
 */
export function authed(test: TestWorld, user: MirrorUser): Promise<Context> {
	return contextFor(test, user);
}

/**
 * The refusal behind a call, so a spec asserts the code rather than "it threw".
 *
 * The domain error arrives as tRPC's `cause`, and that is the plumbing's design rather
 * than an accident of this harness: tRPC knows nothing about `DomainError`, so it wraps
 * any non-TRPC error into `INTERNAL_SERVER_ERROR` and keeps the real one as the cause —
 * which is precisely what the frozen `errorFormatter` reads to put `domainCode` and the
 * Spanish sentence on the wire. Unwrapping it here is the same read a client makes of
 * `error.data.domainCode`, and it is what lets a spec say "an illegal transition is
 * `BAD_REQUEST`" instead of "an illegal transition is a 500".
 *
 * `apps/api/test/errors.test.ts` pins that wire shape end to end, through the real Hono
 * app, so this helper cannot drift from what a client actually receives.
 */
export async function refused(promise: Promise<unknown>): Promise<DomainError> {
	let error: unknown;
	try {
		await promise;
	} catch (caught) {
		error = caught;
	}
	if (error === undefined)
		throw new Error("expected the call to be refused, and it succeeded");

	const domain =
		error instanceof DomainError ? error : (error as { cause?: unknown }).cause;
	if (domain instanceof DomainError) return domain;
	throw error;
}

/** What the consumer decided about each message, which its row count cannot show. */
export type Delivery = {
	batch: MessageBatch<never>;
	/** Messages acked, and the backoff each retry asked for. */
	settled: { acked: number; retried: number[] };
};

/**
 * One queue delivery, with `ack` and `retry` recorded instead of performed.
 *
 * The consumer's two rules — a duplicate is a no-op, a failure is retried — are decisions
 * about *this* object, and a spec that could only count rows would be asserting the
 * consequence and guessing at the decision. Both are worth pinning: an `ack()` on a
 * failure drops a customer's notification, and a `retry()` on a duplicate is a message
 * that will be redelivered forever.
 *
 * `attempts` is a parameter because the backoff is computed from it, so the retry delay is
 * a testable number rather than a constant nobody can reach.
 */
export function delivery(bodies: unknown[], attempts = 0): Delivery {
	const settled = { acked: 0, retried: [] as number[] };
	const messages = bodies.map((body) => ({
		body,
		attempts,
		ack: () => {
			settled.acked += 1;
		},
		retry: (options?: { delaySeconds?: number }) => {
			settled.retried.push(options?.delaySeconds ?? 0);
		},
	}));

	// `queue` and `messages` are the two fields the consumer reads; `metadata`, `ackAll` and
	// `retryAll` are the batch-level calls it does not make, and a stub that invented them
	// would be asserting behaviour nothing exercises.
	return {
		batch: {
			queue: "pymeshub-order-events",
			messages,
		} as unknown as MessageBatch<never>,
		settled,
	};
}
