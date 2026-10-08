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
	priceBook as priceBookTable,
	priceBookPrice as priceBookPriceTable,
	product as productTable,
	review as reviewTable,
	session as sessionTable,
	subscription as subscriptionTable,
	supportTicket as supportTicketTable,
	user as userTable,
} from "@pymeshub/db";
import type {
	CountablePlanLimit,
	Currency,
	TicketStatus,
} from "@pymeshub/shared";
import { newOrderReference, PLAN_LIMITS } from "@pymeshub/shared";
import type {
	DeliverySpeed,
	OrderStatus,
	PaymentStatus,
} from "@pymeshub/shared/order-state";
import {
	CADENCES,
	type Cadence,
	DEFAULT_PLAN,
	effectivePlan,
	LAUNCH_PRICE_BOOK,
	periodDaysFor,
	type Plan,
	PLANS,
	priceMinorFor,
	STATUS_IS_LISTED,
	subscriptionStatusAt,
} from "@pymeshub/shared/plans";
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
/**
 * A stand-in for `RateLimitRoom`, and the only one that behaves like the real thing in
 * the respect that matters: it counts.
 *
 * `ORDER_ROOM` above is a recorder — it captures publishes and asserts on them. This one
 * is different in kind, because `rateLimit`'s correctness *is* its count. A stub that
 * answered `allowed: true` every time would let a spec pass against a limiter that never
 * limits anything, which is the failure mode that let the KV counter ship: the previous
 * `CACHE` stub accepted unlimited writes and never rejected, so nothing in the suite could
 * have noticed the counter provoking a 429.
 *
 * `failNext` exists for the same reason. `rateLimit` swallows anything the object throws
 * and answers "not limited", and that catch is invisible to a test whose storage always
 * works — so the degradation path needs a way to be provoked on demand.
 */
function rateLimitRoom(): {
	namespace: DurableObjectNamespace;
	failNext(error?: Error): void;
} {
	/** Keyed by the DO name, exactly as the real namespace's `idFromName` would key it. */
	const stores = new Map<string, { window: number; count: number }>();
	let failure: Error | null = null;

	return {
		namespace: {
			idFromName: (name: string) => name,
			get: (id: unknown) => {
				const key = String(id);
				return {
					hit: async (limit: number, windowSeconds: number) => {
						if (failure) {
							const error = failure;
							failure = null;
							throw error;
						}
						const window = Math.floor(Date.now() / 1000 / windowSeconds);
						const state = stores.get(key);
						if (!state || state.window !== window) {
							stores.set(key, { window, count: 1 });
							return { allowed: true, count: 1 };
						}
						if (state.count >= limit) {
							return { allowed: false, count: state.count };
						}
						state.count += 1;
						return { allowed: true, count: state.count };
					},
				};
			},
		} as unknown as DurableObjectNamespace,
		failNext: (error?: Error) => {
			failure = error ?? new Error("the rate limiter's storage is unavailable");
		},
	};
}

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
 * An R2 stand-in, and the only binding here that stores bytes.
 *
 * A `Map` of `ArrayBuffer` is a faithful stand-in for the two calls `uploads` makes:
 * `put` and `get` returning an object whose `arrayBuffer()` gives the bytes back. It
 * is worth having separately from `d1Over` because it is what proves the split - the
 * row in D1 holds no bytes at all, so a spec that stores a picture and reads it back
 * is only green if both halves are real and the row alone is not enough.
 *
 * `httpMetadata` is kept because `uploads.create` sets it and a spec asserts it: it is
 * what makes a direct read of the object agree with the `Content-Type` the row names.
 */
/**
 * Raise one plan limit for a spec that needs a shape no plan allows.
 *
 * `PLAN_LIMITS` is a plain exported object rather than a frozen one, so a spec can
 * widen a cap and put it back. It lives here rather than in `@pymeshub/shared` because
 * a test helper in the package every client imports is a test helper that ships.
 *
 * The one limit that needs it is `locations`: **both plans allow exactly one branch**,
 * so the three specs that prove a read is scoped to a location cannot seed a second
 * branch at all. They are testing tenant isolation, which is worth testing whatever the
 * pricing says, and the alternative — relaxing the product, or deleting the coverage —
 * is worse than a named, local, reversible override.
 *
 * A leaked override would make a later spec pass for the wrong reason, so the docblock
 * on `seedBusiness`'s `raiseLimits` makes restoring the caller's job.
 */
function raiseLimit(plan: Plan, limit: CountablePlanLimit, value: number): void {
	PLAN_LIMITS[plan][limit] = value;
}

function r2(): R2Bucket {
	const store = new Map<
		string,
		{ body: ArrayBuffer; httpMetadata?: unknown }
	>();
	return {
		put: async (
			key: string,
			value: ArrayBuffer | ArrayBufferView | string,
			options?: unknown,
		) => {
			store.set(key, {
				body: toArrayBuffer(value),
				httpMetadata: (options as { httpMetadata?: unknown })?.httpMetadata,
			});
			return { key };
		},
		get: async (key: string) => {
			const found = store.get(key);
			if (!found) return null;
			return {
				arrayBuffer: async () => found.body,
				httpMetadata: found.httpMetadata,
			} as unknown as R2ObjectBody;
		},
	} as unknown as R2Bucket;
}

/** The three shapes `R2Bucket.put` accepts, as one `ArrayBuffer`. */
function toArrayBuffer(
	value: ArrayBuffer | ArrayBufferView | string,
): ArrayBuffer {
	if (typeof value === "string") {
		const out = new Uint8Array(value.length);
		for (let i = 0; i < value.length; i += 1) out[i] = value.charCodeAt(i);
		return out.buffer as ArrayBuffer;
	}
	if (value instanceof ArrayBuffer) return value;
	const view = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
	return view.slice().buffer as ArrayBuffer;
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
	/**
	 * Make the **next** `rateLimit` call see its storage throw, so a spec can prove the
	 * limiter degrades to "not limited" instead of refusing the request. The error is
	 * consumed by that one call.
	 */
	failRateLimitOnce: (error?: Error) => void;
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

	const limiter = rateLimitRoom();
	const env = {
		DB: d1Over(sqlite),
		CACHE: kv(),
		MEDIA: r2(),
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
		RATE_LIMIT_ROOM: limiter.namespace,
	} as unknown as Env;

	return {
		sqlite,
		db: createDb(env.DB),
		env,
		/** Make the next `rateLimit` call see its storage throw. See `rateLimitRoom`. */
		failRateLimitOnce: limiter.failNext,
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
 * A price book, so a spec can price something.
 *
 * Seeded with the launch figures because that is what a fresh install has, and because
 * a spec that cares about a *different* price inserts its own rather than depending on
 * this row's numbers. `subscription` specs that care about a price rise insert a second
 * book with a future `effectiveFrom`.
 */
export async function seedPriceBook(
	db: Db,
	overrides: {
		id?: string;
		label?: string;
		/**
		 * Per-pair overrides, keyed `"TIER:CADENCE"` — `{ "STARTER:MONTHLY": 1_400_000 }`.
		 *
		 * Pairs default to the launch book, so a spec that only cares about a tier does not
		 * restate prices, and a spec that needs a different price cannot forget to insert
		 * it, which is exactly what a `0` default would have let it do.
		 */
		prices?: Record<string, number>;
		effectiveFrom?: Date;
	} = {},
): Promise<string> {
	const id = overrides.id ?? "pbk_test_launch";

	await db
		.insert(priceBookTable)
		.values({
			id,
			label: overrides.label ?? "Test",
			effectiveFrom: overrides.effectiveFrom ?? daysAgo(90),
			createdAt: new Date(),
		})
		.onConflictDoNothing();

	// `FREE` is skipped, matching the launch book: a free shop is never charged, and a row
	// priced at 0 would let a spec assert that a free subscription costs nothing instead of
	// asserting that it is never charged.
	for (const plan of PLANS) {
		if (plan === "FREE") continue;
		for (const cadence of CADENCES) {
			await db
				.insert(priceBookPriceTable)
				.values({
					priceBookId: id,
					plan,
					cadence,
					minor:
						overrides.prices?.[`${plan}:${cadence}`] ??
						priceMinorFor(plan, cadence, LAUNCH_PRICE_BOOK),
				})
				.onConflictDoNothing();
		}
	}

	return id;
}

/** `n` days before now — the one clock helper the billing specs need. */
export function daysAgo(n: number): Date {
	return new Date(Date.now() - n * 86_400_000);
}

/**
 * A subscription in a chosen state.
 *
 * The state is expressed as **dates**, not as a `status` string, because the status is
 * derived — `subscriptionStatusAt` reads `periodEnd` and `gracedUntil` and the stored
 * column is only a cache. A fixture that set `status: "PAST_DUE"` and left the dates
 * alone would produce a row the API immediately disagrees with, which is exactly the bug
 * this design removes.
 *
 * `daysUntilDue` is the lever: negative is overdue by that many days, and the grace and
 * hidden windows fall out of it — 10 days late is `GRACE`, 45 is `PAST_DUE`, 120 is
 * `SUSPENDED`.
 */
export async function seedSubscription(
	db: Db,
	input: {
		businessId: string;
		id?: string;
		/** The tier. `FREE` by default so a fixture is on the floor unless it says otherwise. */
		plan?: Plan;
		/**
		 * The cadence. `null` for `FREE` and monthly otherwise, and the **period length
		 * follows it** — 30 days or 365 — because a fixture that wrote a 30-day period onto
		 * a yearly subscription would test a state no real row can hold.
		 */
		cadence?: Cadence | null;
		priceBookId?: string;
		priceMinor?: number | null;
		/** Negative means the period ended that many days ago. */
		daysUntilDue?: number;
		/** Overrides the derived `gracedUntil`; null reproduces the fallback. */
		gracedUntil?: Date | null;
		lastPaidAt?: Date | null;
		/**
		 * Write a stored `status` that disagrees with the dates, to prove a reader
		 * derives rather than trusts. Off by default.
		 */
		storedStatus?: "ACTIVE" | "GRACE" | "PAST_DUE" | "SUSPENDED";
	},
): Promise<string> {
	const id = input.id ?? `sub_test_${input.businessId}`;
	/**
	 * The tier, defaulting to `BUSINESS` rather than to the product's `FREE` floor.
	 *
	 * A fixture default is not a product default: `FREE` is the right floor for a business
	 * and the wrong one for a billing spec, because a free subscription has **no dates at
	 * all** and every spec about grace, arrears or listing would silently be testing a row
	 * the deriver short-circuits before it reads a date. A spec that wants the free tier
	 * says `plan: "FREE"`, and that is a sentence worth writing.
	 */
	const plan = input.plan ?? "BUSINESS";
	// A free subscription has no period at all — see `PLAN_PERIOD_DAYS`, where it is
	// `null` and not zero precisely so nothing can bill it.
	const cadence = input.cadence === undefined && plan === "FREE" ? null : input.cadence ?? "MONTHLY";
	const days = input.daysUntilDue ?? 5;
	const periodLength = periodDaysFor(plan, cadence ?? "MONTHLY") ?? 0;
	const periodStart = new Date(Date.now() + (days - periodLength) * 86_400_000);
	const periodEnd = new Date(Date.now() + days * 86_400_000);
	const priceBookId = input.priceBookId ?? (await seedPriceBook(db));
	const row = {
		id,
		businessId: input.businessId,
		plan,
		cadence,
		priceBookId,
		priceMinor:
			input.priceMinor === undefined
				? cadence === null
					? null
					: priceMinorFor(plan, cadence, LAUNCH_PRICE_BOOK)
				: input.priceMinor,
		status: input.storedStatus ?? ("ACTIVE" as const),
		periodStart,
		periodEnd,
		gracedUntil:
			input.gracedUntil === undefined
				? new Date(periodEnd.getTime() + 30 * 86_400_000)
				: input.gracedUntil,
		lastPaidAt: input.lastPaidAt === undefined ? periodStart : input.lastPaidAt,
		createdAt: daysAgo(60),
		updatedAt: new Date(),
	};

	// **Upsert, not insert.** `subscription.business_id` carries a unique index — one
	// subscription per merchant, which is what stops a double invoice — so a second call
	// for the same business has to *move* the row. `onConflictDoNothing` keeps the
	// first, and a spec that walks a shop through GRACE → PAST_DUE → SUSPENDED would
	// then read the first state three times and assert three times against the same
	// answer.
	await db
		.insert(subscriptionTable)
		.values(row)
		.onConflictDoUpdate({
			target: subscriptionTable.businessId,
			set: {
				plan: row.plan,
				priceBookId: row.priceBookId,
				priceMinor: row.priceMinor,
				status: row.status,
				periodStart: row.periodStart,
				periodEnd: row.periodEnd,
				gracedUntil: row.gracedUntil,
				lastPaidAt: row.lastPaidAt,
				updatedAt: row.updatedAt,
			},
		});

	// Keep the denormalised copy in step, because `business.plan` is what a limit check
	// reads and a fixture that left it at the default would test the wrong thing. The
	// status is derived from the same dates the service will derive, so the two cannot
	// disagree — and `effectivePlan` is applied for the same reason, so a lapsed shop's
	// fixture is already on the floor plan the service will hold it to.
	const status = subscriptionStatusAt(
		{
			plan,
			// A free row has no dates at all, and the fixture has to match: passing a
			// `periodEnd` here would test the deriver against a shape no free subscription
			// can hold, which is the one thing the `plan` short-circuit makes moot.
			periodEnd: cadence === null ? null : periodEnd,
			gracedUntil: cadence === null ? null : row.gracedUntil,
			createdAt: daysAgo(60),
		},
		new Date(),
	);
	await db
		.update(businessTable)
		.set({
			plan: effectivePlan(plan, status),
			listed: STATUS_IS_LISTED[status],
		})
		.where(eq(businessTable.id, input.businessId));

	return id;
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

/**
 * An order row, inserted directly rather than placed through `orders.place`.
 *
 * Placing one properly needs a cart, a category, a product and a membership, and every spec
 * that wants "an order exists so this admin procedure has something to act on" would carry
 * four unrelated fixtures to get there. This writes the row the admin procedures read.
 *
 * It is deliberately **not** a shortcut past the order state machine: `status` and
 * `paymentStatus` are both parameters, so a spec that needs a `PAID` order or a `REFUNDED` one
 * says so. What it does bypass is placement, which is covered by `orders-place.test.ts`.
 */
export async function seedOrder(
	db: Db,
	overrides: {
		id?: string;
		businessId: string;
		customerId: string;
		status?: OrderStatus;
		paymentStatus?: PaymentStatus;
		totalMinor?: number;
		currency?: Currency;
		/**
		 * `EXPRESS` counts against the business's weekly quota; `STANDARD` does not.
		 *
		 * Defaults to `STANDARD`, matching the column, so an existing spec that does not care
		 * about delivery speed is not silently seeding orders that consume a quota.
		 */
		deliverySpeed?: DeliverySpeed;
		/**
		 * When the shop took the order, which is **what the express quota's window reads**.
		 *
		 * `null` is an order still waiting to be accepted. A spec about the quota sets it
		 * explicitly, because the window is anchored on acceptance rather than placement and
		 * a `placedAt`-only fixture would spend a window the order never used.
		 */
		acceptedAt?: Date | null;
	},
): Promise<string> {
	const id = overrides.id ?? `ord_test_${overrides.businessId}`;
	const now = new Date();
	const totalMinor = overrides.totalMinor ?? 10_000;
	await db.insert(orderTable).values({
		id,
		reference: `CR-${id.toUpperCase()}`,
		customerId: overrides.customerId,
		businessId: overrides.businessId,
		fulfilment: "PICKUP",
		deliverySpeed: overrides.deliverySpeed ?? "STANDARD",
		status: overrides.status ?? ("COMPLETED" as OrderStatus),
		paymentMethod: "SINPE_MOVIL",
		paymentStatus: overrides.paymentStatus ?? ("PAID" as PaymentStatus),
		currency: overrides.currency ?? ("CRC" as Currency),
		subtotalMinor: totalMinor,
		totalMinor,
		acceptedAt:
			overrides.acceptedAt === undefined
				? (overrides.status ?? "COMPLETED") === "PENDING"
					? null
					: now
				: overrides.acceptedAt,
		placedAt: now,
		createdAt: now,
		updatedAt: now,
	});
	return id;
}

/**
 * A support ticket, for specs about what support said to a merchant.
 *
 * `supportTicket.businessId` is one of the columns that **cascades**, so a ticket is also the
 * cheapest way to prove a record outlives its business — see `admin-contract.test.ts`.
 */
export async function seedSupportTicket(
	db: Db,
	overrides: {
		id?: string;
		businessId: string;
		openedBy: string;
		subject?: string;
		status?: TicketStatus;
	},
): Promise<string> {
	const id = overrides.id ?? `tkt_test_${overrides.businessId}`;
	const now = new Date();
	await db.insert(supportTicketTable).values({
		id,
		businessId: overrides.businessId,
		openedBy: overrides.openedBy,
		category: "OTHER",
		subject: overrides.subject ?? "Prueba de soporte",
		status: overrides.status ?? ("OPEN" as TicketStatus),
		createdAt: now,
		updatedAt: now,
	});
	return id;
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
		/**
		 * The tier, which decides what the shop may do.
		 *
		 * Defaults to `BUSINESS`, **not** to the `FREE` floor the schema defaults to, and
		 * the reason is that most of this suite is about scoping and permissions rather
		 * than limits: a spec that seeds two locations or two staff members to prove a
		 * read is scoped correctly would otherwise fail on a quota it is not testing.
		 * `BUSINESS` permits the widest set, so those specs say what they mean.
		 *
		 * A spec that *is* about limits passes `FREE` or a lower tier explicitly, and
		 * `plan-limits` has one for each capped limit.
		 */
		plan?: Plan;
		/**
		 * Raise one plan limit for the duration of a spec, for the cases **no tier can
		 * express**.
		 *
		 * `locations` is one: no tier below `GROWTH` allows a second branch, so a spec that
		 * needs two to prove a read is scoped to a location has nothing to seed without
		 * borrowing `GROWTH` — which would make a scoping spec quietly depend on a pricing
		 * decision. Three such specs exist — `business-home`, `business-analytics` and
		 * `locations` — and all three are about tenant scoping, which is a property worth
		 * testing regardless of how many branches a merchant may open.
		 *
		 * The alternative would be weakening the product to suit the tests, and the third
		 * option, deleting the specs, loses the coverage. So this raises the cap, names
		 * itself after what it is, and returns a restore function the spec must call:
		 *
		 * const restore = raiseLimit("BUSINESS", "locations", 3);
		 * try { … } finally { restore(); }
		 * ```
		 *
		 * A limit that leaked past its spec would make a later spec pass for the wrong
		 * reason, which is why restoring is the caller's job rather than a fixture
		 * teardown the harness cannot enforce.
		 */
		raiseLimits?: Partial<Record<CountablePlanLimit, number>>;
	} = {},
): Promise<string> {
	const id = overrides.id ?? "biz_test_shop";
	for (const [key, value] of Object.entries(overrides.raiseLimits ?? {})) {
		raiseLimit(overrides.plan ?? "BUSINESS", key as CountablePlanLimit, value);
	}
	await db.insert(businessTable).values({
		id,
		slug: overrides.slug ?? `tienda-${id}`,
		name: overrides.name ?? "Tienda de Prueba",
		currency: "CRC",
		plan: overrides.plan ?? "BUSINESS",
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
		/** A real discount needs the compare-at above the price — see the offer rule. */
		compareAtPriceMinor?: number | null;
		soldCount?: number;
		isFeatured?: boolean;
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
		isFeatured: input.isFeatured ?? false,
		compareAtPriceMinor: input.compareAtPriceMinor ?? null,
		soldCount: input.soldCount ?? 0,
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
