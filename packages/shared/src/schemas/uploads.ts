/**
 * Image uploads - the one place a client and the Worker agree on what a picture is
 * before any bytes move.
 *
 * The transport is base64 inside a tRPC mutation rather than multipart: the clients
 * already hold a tRPC connection with the session's bearer token attached, and a
 * `FormData` body would need a second, parallel auth story for one endpoint. The cost
 * is a third of the payload in encoding, which a 4 MiB photograph can afford.
 *
 * `scope` is the key namespace the upload lands under - `courier-vehicle` today, an
 * avatar or a product photo tomorrow. It is a path segment the server builds itself
 * from a validated pattern, never a string the caller controls beyond that pattern.
 */

import { z } from "zod";

/** Raw bytes a single image may occupy once decoded. Four mebibytes. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Base64 length ceiling for the raw cap above: ceil(n / 3) * 4, with slack for padding. */
export const MAX_UPLOAD_BASE64_LENGTH = Math.ceil(MAX_UPLOAD_BYTES / 3) * 4 + 16;

export const uploadImageInput = z.object({
	/** Key namespace: lowercase letters, digits and dashes, first a letter. */
	scope: z
		.string()
		.trim()
		.regex(/^[a-z][a-z0-9-]{0,31}$/, "Alcance de imagen no válido"),
	contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
	/** Raw base64 - no `data:` prefix, no line breaks. */
	dataBase64: z
		.string()
		.min(1)
		.max(MAX_UPLOAD_BASE64_LENGTH, "La imagen es demasiado grande"),
});
export type UploadImageInput = z.infer<typeof uploadImageInput>;

export const uploadImageSchema = z.object({
	/** Relative path the image is served from, ready for `imageUrlSchema`. */
	url: z.string(),
});
export type UploadImage = z.infer<typeof uploadImageSchema>;
