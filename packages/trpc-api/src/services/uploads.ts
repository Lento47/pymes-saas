import { createDb, upload as uploadTable } from "@pymeshub/db";
import {
	MAX_UPLOAD_BYTES,
	newId,
	type UploadCreateInput,
	type UploadRef,
} from "@pymeshub/shared";
import { eq } from "drizzle-orm";

import type { Env } from "../env";
import { ValidationError } from "../errors";
import type { UserContext } from "./helpers";

/**
 * Storing a picture, and the one place that decides what a picture may be.
 *
 * The bytes live in the `MEDIA` R2 bucket; the `upload` row is the index that says
 * what an object is, who put it there and how to serve it. That split is not a
 * preference — D1 caps a database at 10 GB with no way to raise it, so pictures in
 * D1 would put the whole marketplace at roughly 5,000 images and then stop.
 *
 * The write is authenticated (`protectedProcedure`) and the *read* is not — see the
 * serve route in `../app.ts`. That split is the product, not a shortcut: a product
 * photo has to appear on a storefront a visitor has not signed in to, and an image
 * URL that needed a bearer token would be a URL `Image` in React Native cannot
 * follow without a header bolted onto every call site.
 *
 * What keeps that safe is the *kind* of thing this accepts. JPEG, PNG and WebP under
 * `MAX_UPLOAD_BYTES`, and nothing else — no SVG (which is markup and can run), no
 * PDF, no archive. `uploadCreateInput`'s enum is the allow-list and this module
 * re-states it because the serve route's `Content-Type` is whatever the row says, so
 * the two ends of that row have to agree on what may be in it.
 */

const ALLOWED_MIME: ReadonlySet<string> = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
]);

/** The refusal's words, as a key the client resolves in the reader's language. */
const PHOTO_RULE = "biz.products.photo.rule";

export async function create(
	ctx: UserContext,
	input: UploadCreateInput,
): Promise<UploadRef> {
	const bytes = decodeBase64(input.base64);
	// Measured after decode, not from the string's length: base64 of an empty input
	// and base64 of a truncated one both look like "a short string", and the ceiling
	// is about the picture rather than about the envelope carrying it. The schema
	// bounds `base64` in characters, which is a looser thing — it cannot tell 2 MiB
	// from 2.67 MiB — so this is the only check that means what the constant says.
	if (bytes.byteLength === 0 || bytes.byteLength > MAX_UPLOAD_BYTES) {
		throw new ValidationError(PHOTO_RULE, { field: "base64" });
	}
	if (!ALLOWED_MIME.has(input.mimeType)) {
		throw new ValidationError(PHOTO_RULE, { field: "mimeType" });
	}

	const id = newId("upload");
	const path = `/files/${id}`;

	// The object goes first, the row second.
	//
	// The two failures are not symmetric. An object with no row is an orphan: one
	// unused object in a bucket that costs $0.015/GB-month and is findable by prefix.
	// A row with no object is a storefront with a broken picture, which is the failure
	// a customer sees. So the order is the one where the tolerable failure is the
	// possible one, and this half of `uploadsRouter`'s docblock is why an orphaned
	// object is described as cheap rather than as a leak.
	//
	// `httpMetadata` is not decoration either: `/files/:id` serves whatever
	// `Content-Type` the row names, and R2's own `httpMetadata` is what makes a
	// direct read of the object agree with that. Written once, in one place.
	await ctx.env.MEDIA.put(path, bytes, {
		httpMetadata: { contentType: input.mimeType },
	});

	await ctx.db.insert(uploadTable).values({
		id,
		// The object key and the serve path are the same string, and that is the point
		// rather than a convenience: the path a product's `imageUrl` holds is
		// `/files/:id`, and a key derived from the id means the serve route needs no
		// second naming scheme to keep in step with the write.
		key: path,
		mimeType: input.mimeType,
		sizeBytes: bytes.byteLength,
		ownerUserId: ctx.user.id,
		createdAt: new Date(),
	});

	return { id, path, mimeType: input.mimeType, sizeBytes: bytes.byteLength };
}

/**
 * The stored object, for the serve route.
 *
 * Public by design and therefore not a `UserContext` read: the caller may be a
 * visitor with no session at all. Id-exact — the request names an id, the row is
 * looked up by that id, and the row's own `key` is what gets fetched. An id is not
 * enumerable, so this is not a listing however the two-step lookup reads.
 *
 * Takes the whole `Env` rather than a `Db` because the row is now half the answer:
 * the bytes are in `MEDIA`, and a database handle cannot reach them. `createDb` is
 * called here for the same reason `app.ts` builds one per request — one function,
 * one place that knows the driver.
 */
export async function read(
	env: Env,
	id: string,
): Promise<{ mimeType: string; data: Uint8Array } | null> {
	const db = createDb(env.DB);
	const rows = await db
		.select({ key: uploadTable.key, mimeType: uploadTable.mimeType })
		.from(uploadTable)
		.where(eq(uploadTable.id, id))
		.limit(1);

	const row = rows[0];
	// A row whose object is gone — the case `upload`'s docblock exists to make
	// findable — answers exactly like an id that was never minted. Both are 404, and
	// neither is distinguishable from the other by a caller.
	if (!row) return null;

	const object = await env.MEDIA.get(row.key);
	if (!object) return null;

	return {
		mimeType: row.mimeType,
		data: new Uint8Array(await object.arrayBuffer()),
	};
}

/** `atob` then widen: Workers and Bun both have `atob`, and neither returns bytes. */
function decodeBase64(value: string): Uint8Array {
	let binary: string;
	try {
		binary = atob(value);
	} catch {
		throw new ValidationError(PHOTO_RULE, { field: "base64" });
	}
	const out = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
	return out;
}
