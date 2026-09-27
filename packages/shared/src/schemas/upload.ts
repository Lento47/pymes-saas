/**
 * What may be stored as a picture, and the ceiling it lives under.
 *
 * Marketplace imagery only — a product's photo, a shop's logo or cover, a profile
 * picture. Those are read by customers who may not be signed in: `/files/:id` is a
 * public serve route by design, because a storefront a visitor cannot see the
 * pictures on is not a storefront. Anything private does not belong in this pipeline
 * and has nowhere else to go while the bucket behind it is a single shared `MEDIA`
 * (`packages/trpc-api/wrangler.toml`).
 *
 * The bytes travel as base64 because the write is a tRPC mutation and a mutation
 * takes JSON. That is a deliberate ceiling rather than an oversight: the path is for
 * a phone camera roll, not for a video, and `MAX_UPLOAD_BYTES` is what says so in the
 * same place the UI reads it. It is also well clear of the limits it used to sit
 * against — R2 accepts objects up to 5 GB, so 2 MiB is a product decision rather
 * than a platform one. (It was *not* clear of the limit it sat against before: D1's
 * maximum row is 2,000,000 bytes and `2 * 1024 * 1024` is 2,097,152, so a file
 * between those two passed this schema and then failed at insert.)
 */

import { z } from "zod";

import { uploadIdSchema } from "./common";

export const UPLOAD_MIME_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
] as const;
export type UploadMimeType = (typeof UPLOAD_MIME_TYPES)[number];

/**
 * 2 MiB of decoded bytes — the same ceiling `apps/web`'s avatar upload enforces, so
 * the two surfaces refuse the same file rather than one accepting what the other
 * rejects.
 */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** Base64 of `MAX_UPLOAD_BYTES`, rounded up to a whole group, plus padding slack. */
export const MAX_UPLOAD_BASE64_CHARS = Math.ceil(MAX_UPLOAD_BYTES / 3) * 4 + 4;

export const uploadCreateInput = z.object({
	mimeType: z.enum(UPLOAD_MIME_TYPES),
	/** Raw base64 — no `data:` prefix. The API decodes and measures the bytes. */
	base64: z.string().min(1).max(MAX_UPLOAD_BASE64_CHARS),
});
export type UploadCreateInput = z.infer<typeof uploadCreateInput>;

/**
 * The answer to a create: enough to draw the picture and enough to store on the
 * row that will point at it.
 *
 * `path` is a root-relative `/files/:id`, which is exactly what `imageUrlSchema`
 * already accepts — so a product's `imageUrl` and a profile's `image` take this
 * value unchanged, and a client resolves the root against its API origin.
 */
export const uploadRefSchema = z.object({
	id: uploadIdSchema,
	path: z.string().startsWith("/files/"),
	mimeType: z.enum(UPLOAD_MIME_TYPES),
	sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});
export type UploadRef = z.infer<typeof uploadRefSchema>;
