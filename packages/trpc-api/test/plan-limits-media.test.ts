import { describe, expect, test } from "bun:test";
import { upload as uploadTable } from "@pymeshub/db";
import { PLAN_LIMITS, productCreateInput } from "@pymeshub/shared";

import { appRouter } from "../src/routers";
import {
	authed,
	refused,
	seedBusiness,
	seedMembership,
	seedUser,
	world,
} from "./harness";

/**
 * The media, option and gallery caps a plan sells, and the refusals behind them.
 *
 * Same conventions as `plan-limits.test.ts`: seed to the boundary, assert the
 * refusal names the tier that lifts it, and assert the shape (`FORBIDDEN` carrying
 * `QUOTA_EXCEEDED`) rather than "it threw". Three claims:
 *
 * 1. **Storage is counted per tenant.** The `upload` row carries the `businessId`
 *    the client sent, and only that shop's bytes count. A shop may fill exactly to
 *    its cap; the byte over it is refused.
 * 2. **Gallery and option counts are counted on the result.** Cover plus gallery is
 *    the picture set, and `optionGroups` is replaced wholesale — so `create` checks
 *    the payload and `update` checks only the fields it touches.
 * 3. **Attribution is gated.** A caller outside the shop cannot bill its storage,
 *    and an upload with no tenant is never counted.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;

/** A real 1x1 PNG, so the bytes going in are bytes and not a placeholder string. */
const PNG_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function freeShop(w: ReturnType<typeof world>, id: string) {
	const businessId = await seedBusiness(w.db, { id, plan: "FREE" });
	const owner = await seedUser(w.db, { id: `${id}_owner` });
	await seedMembership(w.db, owner.id, businessId, "OWNER");
	const caller = appRouter.createCaller(await authed(w, owner)) as Caller;
	return { businessId, caller, owner };
}

function newProduct(
	businessId: string,
	name: string,
	extra: {
		images?: string[];
		imageUrl?: string;
		optionGroups?: { name: string; options: { name: string; priceDeltaMinor: number }[] }[];
	} = {},
) {
	return {
		...productCreateInput.parse({
			name,
			priceMinor: 1_000,
			status: "ACTIVE",
			...extra,
		}),
		businessId,
	};
}

function optionGroup(name: string, optionCount: number) {
	return {
		name,
		options: Array.from({ length: optionCount }, (_, index) => ({
			name: `Opción ${index}`,
			priceDeltaMinor: 0,
		})),
	};
}

async function seedUploadBytes(
	w: ReturnType<typeof world>,
	ownerId: string,
	businessId: string | null,
	sizeBytes: number,
) {
	await w.db.insert(uploadTable).values({
		id: `upl_seed_${businessId ?? "none"}_${sizeBytes}`,
		key: `/files/seed-${businessId ?? "none"}-${sizeBytes}`,
		mimeType: "image/png",
		sizeBytes,
		ownerUserId: ownerId,
		businessId,
		createdAt: new Date(),
	});
}

describe("the storage cap", () => {
	test("an upload past the cap is refused and names the tier that lifts it", async () => {
		const w = world();
		const { businessId, caller, owner } = await freeShop(w, "biz_media_storage");
		const cap = PLAN_LIMITS.FREE.storageBytes;
		const probe = await caller.uploads.create({
			mimeType: "image/png",
			base64: PNG_BASE64,
			businessId,
			purpose: "product",
		});
		// Fill to one byte below what this upload would reach, so the refusal is the
		// upload itself and not the arithmetic around it.
		await seedUploadBytes(w, owner.id, businessId, cap - probe.sizeBytes + 1);

		const error = await refused(
			caller.uploads.create({
				mimeType: "image/png",
				base64: PNG_BASE64,
				businessId,
				purpose: "product",
			}),
		);
		expect(error.code).toBe("FORBIDDEN");
		const details = error.details as {
			error: string;
			limit: string;
			plan: string;
			upgradeTo: string;
		};
		expect(details.error).toBe("QUOTA_EXCEEDED");
		expect(details.limit).toBe("storageBytes");
		expect(details.plan).toBe("FREE");
		expect(details.upgradeTo).toBe("EMPRENDE");

		w.close();
	});

	test("filling exactly to the cap is allowed", async () => {
		const w = world();
		const { businessId, caller, owner } = await freeShop(w, "biz_media_exact");
		const cap = PLAN_LIMITS.FREE.storageBytes;
		const probe = await caller.uploads.create({
			mimeType: "image/png",
			base64: PNG_BASE64,
			businessId,
			purpose: "product",
		});
		// The probe row counts too, so the seed leaves room for exactly one more
		// upload: probe + seed + final === cap.
		await seedUploadBytes(w, owner.id, businessId, cap - probe.sizeBytes * 2);

		const ref = await caller.uploads.create({
			mimeType: "image/png",
			base64: PNG_BASE64,
			businessId,
			purpose: "product",
		});
		expect(ref.path.startsWith("/files/")).toBe(true);

		w.close();
	});

	test("another shop's bytes are not counted", async () => {
		const w = world();
		const first = await freeShop(w, "biz_media_mine");
		const second = await freeShop(w, "biz_media_theirs");
		await seedUploadBytes(
			w,
			second.owner.id,
			second.businessId,
			PLAN_LIMITS.FREE.storageBytes,
		);

		const ref = await first.caller.uploads.create({
			mimeType: "image/png",
			base64: PNG_BASE64,
			businessId: first.businessId,
			purpose: "product",
		});
		expect(ref.path.startsWith("/files/")).toBe(true);

		w.close();
	});

	test("an upload with no tenant is never counted", async () => {
		const w = world();
		const { businessId, caller, owner } = await freeShop(w, "biz_media_full");
		await seedUploadBytes(w, owner.id, businessId, PLAN_LIMITS.FREE.storageBytes);

		const ref = await caller.uploads.create({
			mimeType: "image/png",
			base64: PNG_BASE64,
		});
		expect(ref.path.startsWith("/files/")).toBe(true);

		w.close();
	});

	test("a caller outside the shop cannot bill its storage", async () => {
		const w = world();
		const { businessId } = await freeShop(w, "biz_media_stranger");
		const stranger = await seedUser(w.db, { id: "usr_media_stranger" });
		const caller = appRouter.createCaller(await authed(w, stranger)) as Caller;

		const error = await refused(
			caller.uploads.create({
				mimeType: "image/png",
				base64: PNG_BASE64,
				businessId,
				purpose: "product",
			}),
		);
		expect(error.code).toBe("FORBIDDEN");
		expect(
			(error.details as { error?: string } | null)?.error ?? null,
		).not.toBe("QUOTA_EXCEEDED");

		w.close();
	});
});

describe("the gallery and option caps", () => {
	test("cover plus gallery over two pictures is refused on FREE", async () => {
		const w = world();
		const { businessId, caller } = await freeShop(w, "biz_media_gallery");

		const error = await refused(
			caller.products.create(
				newProduct(businessId, "Demasiadas fotos", {
					imageUrl: "/files/cover",
					images: ["/files/seed-a", "/files/seed-b"],
				}),
			),
		);
		expect(error.code).toBe("FORBIDDEN");
		const details = error.details as {
			error: string;
			limit: string;
			max: number;
			upgradeTo: string;
		};
		expect(details.error).toBe("QUOTA_EXCEEDED");
		expect(details.limit).toBe("imagesPerProduct");
		expect(details.max).toBe(PLAN_LIMITS.FREE.imagesPerProduct);
		expect(details.upgradeTo).toBe("EMPRENDE");

		// Landing exactly on the cap is allowed.
		const created = await caller.products.create(
			newProduct(businessId, "Justo dos", {
				imageUrl: "/files/cover",
				images: ["/files/seed-a"],
			}),
		);
		expect(created.id.length).toBeGreaterThan(0);

		w.close();
	});

	test("a price-only update on an at-cap product is not refused", async () => {
		const w = world();
		const { businessId, caller } = await freeShop(w, "biz_media_price");
		const created = await caller.products.create(
			newProduct(businessId, "Al tope", {
				imageUrl: "/files/cover",
				images: ["/files/seed-a"],
			}),
		);

		const updated = await caller.products.update({
			businessId,
			id: created.id,
			priceMinor: 2_000,
		});
		expect(updated.priceMinor).toBe(2_000);

		w.close();
	});

	test("a second option group is refused on FREE", async () => {
		const w = world();
		const { businessId, caller } = await freeShop(w, "biz_media_groups");

		const error = await refused(
			caller.products.create({
				...newProduct(businessId, "Demasiados grupos"),
				optionGroups: [optionGroup("Tamaño", 2), optionGroup("Extras", 2)],
			}),
		);
		expect(error.code).toBe("FORBIDDEN");
		const details = error.details as { error: string; limit: string };
		expect(details.error).toBe("QUOTA_EXCEEDED");
		expect(details.limit).toBe("optionGroupsPerProduct");

		w.close();
	});

	test("a group of six options is refused where five is the cap", async () => {
		const w = world();
		const { businessId, caller } = await freeShop(w, "biz_media_options");

		const error = await refused(
			caller.products.create({
				...newProduct(businessId, "Demasiadas opciones"),
				optionGroups: [optionGroup("Sabores", 6)],
			}),
		);
		expect(error.code).toBe("FORBIDDEN");
		const details = error.details as {
			error: string;
			limit: string;
			max: number;
		};
		expect(details.error).toBe("QUOTA_EXCEEDED");
		expect(details.limit).toBe("optionsPerGroup");
		expect(details.max).toBe(PLAN_LIMITS.FREE.optionsPerGroup);

		w.close();
	});

	test("an update without option groups leaves them untouched", async () => {
		const w = world();
		const { businessId, caller } = await freeShop(w, "biz_media_rename");
		const created = await caller.products.create({
			...newProduct(businessId, "Con grupo"),
			optionGroups: [optionGroup("Tamaño", 2)],
		});

		const updated = await caller.products.update({
			businessId,
			id: created.id,
			name: "Con grupo, renombrado",
		});
		expect(updated.optionGroups.length).toBe(1);

		w.close();
	});
});
