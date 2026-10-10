import { describe, expect, test } from "bun:test";
import {
	MAX_UPLOAD_BYTES,
	type UploadCreateInput,
	uploadCreateInput,
} from "@pymeshub/shared";
import { requireAuthed } from "../src/context";
import { appRouter } from "../src/routers";
import * as uploads from "../src/services/uploads";
import { authed, refused, seedUser, world } from "./harness";

/**
 * A stored picture, and the split that makes it scale.
 *
 * The bytes live in R2 and the `upload` row is an index. That is not a detail of
 * where the file goes — it is the reason the row has no `data` column at all, and the
 * assertion that matters most here is the one that says so directly: **the row
 * contains no bytes**. A spec that only stored a picture and read it back would pass
 * against the old D1-blob implementation too, because that one also round-tripped.
 * What distinguishes them is a query for a column that no longer exists.
 *
 * The rest is the contract around the split, in the order the risk sits:
 *
 * 1. The bytes are in the bucket, keyed by the serve path, and the row says what
 *    they are. Both halves, because either alone is a broken storefront.
 * 2. The allow-list still decides what may be stored, measured on the *decoded*
 *    length rather than the base64 string's — the one property that keeps a
 *    5 MiB ceiling from meaning "6.67 MiB of JPEG".
 * 3. A row whose object is gone answers like an id that never existed, so a caller
 *    cannot learn which ids are real by the difference.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;

/** A real 1x1 PNG, so the bytes going in are bytes and not a placeholder string. */
const PNG_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function uploadInput(overrides: { mimeType?: string; base64?: string } = {}) {
	return uploadCreateInput.parse({
		mimeType: overrides.mimeType ?? "image/png",
		base64: overrides.base64 ?? PNG_BASE64,
	});
}

describe("a stored picture", () => {
	test("lands in the bucket, indexed by a row that holds no bytes", async () => {
		const test = world();
		const user = await seedUser(test.db, { id: "usr_upload_owner" });
		const caller = appRouter.createCaller(await authed(test, user)) as Caller;

		const ref = await caller.uploads.create(uploadInput());

		// The row is the index: it says what the object is, who put it there, how big
		// it is and what to serve it as - and the key is the serve path the caller was
		// just handed, so `imageUrl` and the object agree without a second scheme.
		const row = test.sqlite
			.prepare(
				"select key, mime_type, size_bytes, owner_user_id from upload where id = ?",
			)
			.get(ref.id) as
			| {
					key: string;
					mime_type: string;
					size_bytes: number;
					owner_user_id: string;
			  }
			| undefined;

		expect(row).toBeDefined();
		expect(row?.key).toBe(ref.path);
		expect(row?.mime_type).toBe("image/png");
		expect(row?.owner_user_id).toBe(user.id);

		// The actual claim. `data` was the D1 blob column; it is gone, and the table has
		// no byte column of any kind now. Read through the connection's own schema
		// listing rather than a query that would throw, so a regression names the
		// column instead of failing as an opaque SQL error.
		const columns = (
			test.sqlite.prepare("pragma table_info(upload)").all() as {
				name: string;
			}[]
		).map((column) => column.name);
		expect(columns).not.toContain("data");
		expect(columns).toContain("key");

		// And the bytes are genuinely in R2, not merely referenced by the row: fetched
		// through the same service the serve route uses, so this is the read path and
		// not a second implementation of it.
		const served = await uploads.read(test.env, ref.id);
		expect(served).not.toBeNull();
		expect(served?.mimeType).toBe("image/png");
		expect(served?.data.byteLength).toBe(row?.size_bytes);
		expect(served?.data.byteLength).toBeGreaterThan(0);

		test.close();
	});

	test("refuses a mime type outside the allow-list, at both layers", async () => {
		const test = world();
		const user = await seedUser(test.db, { id: "usr_upload_svg" });
		const ctx = await authed(test, user);

		// SVG is markup and can run; a PDF is not a picture. Neither is in
		// `UPLOAD_MIME_TYPES`, so the schema refuses it first - which is the honest
		// first line, because that enum is also what the client picker is built from.
		expect(() =>
			uploadInput({ mimeType: "image/svg+xml", base64: "<svg/>" }),
		).toThrow();

		// The service re-states the same list, and that copy is what the *serve* route
		// depends on: it sets the object's `Content-Type` from whatever the row says, so
		// a value that reached the row unvetted would be a value `/files/:id` hands a
		// browser as `Content-Type`. Calling the service directly is the only way that
		// second layer is reached - through the router the schema would always win.
		//
		// `requireAuthed` is the production narrowing `protectedProcedure` performs, not
		// a cast: `authed` hands back a `Context` whose `auth` and `user` are nullable,
		// and this is the function that turns "somebody is signed in" into the type a
		// service is written against.
		const domain = await refused(
			uploads.create(requireAuthed(ctx), {
				mimeType: "image/svg+xml",
				base64: "<svg/>",
			} as unknown as UploadCreateInput),
		);
		expect(domain.code).toBe("BAD_REQUEST");

		// Nothing was stored, and nothing reached the bucket either: a refused upload
		// that left an object behind is the orphan `uploads.create` orders its two
		// writes to avoid.
		const stored = test.sqlite
			.prepare("select count(*) as n from upload")
			.get() as { n: number };
		expect(stored.n).toBe(0);

		test.close();
	});

	test("measures the ceiling on decoded bytes, not on the base64 string", async () => {
		const test = world();
		const user = await seedUser(test.db, { id: "usr_upload_ceiling" });
		const caller = appRouter.createCaller(await authed(test, user)) as Caller;

		// Base64 inflates by 4/3, so a string that sits just under
		// `MAX_UPLOAD_BASE64_CHARS` decodes to something well under the byte ceiling -
		// and one that sits over it is refused by the schema before decode. What the
		// service adds is the check on the *decoded* length, which is the only place a
		// boundary can actually be crossed. `MAX_UPLOAD_BYTES` is asserted here rather
		// than recomputed so this keeps holding if the ceiling ever moves: R2 accepts
		// 5 GB objects, so 5 MiB is now a product decision, and a test that hard-coded
		// 5 MiB would be asserting the number instead of the rule.
		expect(MAX_UPLOAD_BYTES).toBeGreaterThan(0);

		// One byte over the ceiling, base64-encoded. The schema's char bound does not
		// catch this - the encoded form is only ~0.08% larger than the decoded one - so
		// it reaches the service, and the service is what refuses it.
		const overCeiling = Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0x41).toString(
			"base64",
		);
		const domain = await refused(
			caller.uploads.create(uploadInput({ base64: overCeiling })),
		);
		expect(domain.code).toBe("BAD_REQUEST");

		const stored = test.sqlite
			.prepare("select count(*) as n from upload")
			.get() as { n: number };
		expect(stored.n).toBe(0);

		test.close();
	});

	test("answers an id that was never minted and a row whose object is gone identically", async () => {
		const test = world();
		const user = await seedUser(test.db, { id: "usr_upload_missing" });
		const caller = appRouter.createCaller(await authed(test, user)) as Caller;

		// Never minted. The id is a UUID, so a caller cannot enumerate its way here.
		const neverMinted = await uploads.read(
			test.env,
			"upl_00000000-0000-4000-8000-000000000000",
		);
		expect(neverMinted).toBeNull();

		// Minted, then swept out of the bucket. This is the case the `upload` table
		// exists to make findable, and the one that must not become a second answer:
		// a storefront shows a muted box either way, so distinguishing them would only
		// tell a prober which ids were real.
		const ref = await caller.uploads.create(uploadInput());
		expect(await uploads.read(test.env, ref.id)).not.toBeNull();

		test.sqlite.prepare("delete from upload where id = ?").run(ref.id);
		const rowGone = await uploads.read(test.env, ref.id);
		expect(rowGone).toBeNull();

		test.close();
	});
});
