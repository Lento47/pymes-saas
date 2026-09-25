/**
 * Image bytes in R2, with the row that says who owns them.
 *
 * The pipeline is deliberately small: decode, size-check, put, record. The
 * `upload` row is not decoration - it is what makes `dropImage` able to prove
 * a URL being deleted belongs to the caller asking for the deletion, so a
 * courier cannot point a profile save at someone else's object and have the
 * Worker take it out of the bucket.
 *
 * Serving is a Worker route (`GET /uploads/*` in `app.ts`), not a presigned
 * URL: the images are public by design (a business must see a courier's
 * vehicle photo before inviting them), a Worker route can set an immutable
 * cache header, and a relative URL is what `imageUrlSchema` already accepts.
 */

import { upload as uploadTable } from "@pymeshub/db";
import {
	MAX_UPLOAD_BYTES,
	type UploadImage,
	type UploadImageInput,
	newId,
} from "@pymeshub/shared";
import { eq } from "drizzle-orm";

import { ValidationError } from "../errors";
import type { UserContext } from "./helpers";

/** What each accepted content type becomes as a file extension. */
const EXTENSIONS: Record<UploadImageInput["contentType"], string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
};

/** Base64 to bytes, or a sentence the reader can act on. */
function decode(dataBase64: string): Uint8Array {
	let binary: string;
	try {
		binary = atob(dataBase64);
	} catch {
		throw new ValidationError("La imagen no es válida");
	}
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

/**
 * Store one image and hand back the path it is served from.
 *
 * The key is built here and never from caller text beyond `scope`, which the
 * input schema has already pinned to a path-safe pattern - the caller's id is
 * the other segment, and the name is a generated id. No two uploads can share
 * a key, so an overwriting PUT is not a way to replace someone else's photo.
 */
export async function putImage(
	ctx: UserContext,
	input: UploadImageInput,
): Promise<UploadImage> {
	const bytes = decode(input.dataBase64);
	if (bytes.byteLength > MAX_UPLOAD_BYTES) {
		throw new ValidationError("La imagen es demasiado grande (máximo 4 MB)");
	}

	const key = `images/${input.scope}/${ctx.user.id}/${newId("upload")}.${EXTENSIONS[input.contentType]}`;
	await ctx.env.MEDIA.put(key, bytes, {
		httpMetadata: { contentType: input.contentType },
	});
	await ctx.db.insert(uploadTable).values({
		id: newId("upload"),
		key,
		mimeType: input.contentType,
		sizeBytes: bytes.byteLength,
		ownerUserId: ctx.user.id,
		createdAt: new Date(),
	});

	return { url: `/uploads/${key}` };
}

/**
 * Remove an image the caller owns, and only that.
 *
 * Called when a profile's photo URL changes: the old object would otherwise
 * sit in the bucket forever with a row pointing at nothing. A URL that is not
 * ours - not an `/uploads/` path, or one whose row belongs to someone else -
 * is left alone; the profile simply stops referencing it, which is a correct
 * outcome and not a failure.
 */
export async function dropImage(
	ctx: UserContext,
	url: string,
): Promise<void> {
	if (!url.startsWith("/uploads/")) return;
	const key = url.slice("/uploads/".length);
	if (!key || key.includes("..")) return;

	const rows = await ctx.db
		.select()
		.from(uploadTable)
		.where(eq(uploadTable.key, key))
		.limit(1);
	const row = rows[0];
	if (!row || row.ownerUserId !== ctx.user.id) return;

	await ctx.env.MEDIA.delete(key);
	await ctx.db.delete(uploadTable).where(eq(uploadTable.id, row.id));
}
