import { describe, expect, test } from "bun:test";
import { MAX_UPLOAD_BYTES } from "@pymeshub/shared";
import { paymentProofImage } from "./payment-proof-image";

describe("SINPE receipt image payload", () => {
	test("identifies JPEG output without depending on the original screenshot metadata", () => {
		const asset = {
			mimeType: "image/png",
			base64: btoa("\xff\xd8\xff\xe0receipt"),
		};
		expect(paymentProofImage(asset.base64)).toEqual({
			base64: asset.base64,
			mimeType: "image/jpeg",
		});
	});
	test("preserves actual PNG and WebP receipts", () => {
		const png = btoa("\x89PNG\r\n\x1a\nreceipt");
		const webp = btoa("RIFF\x00\x00\x00\x00WEBPreceipt");
		expect(paymentProofImage(png)).toEqual({
			base64: png,
			mimeType: "image/png",
		});
		expect(paymentProofImage(webp)).toEqual({
			base64: webp,
			mimeType: "image/webp",
		});
	});
	test("refuses missing, malformed, and unsupported files", () => {
		for (const data of [
			null,
			undefined,
			"",
			"a",
			"%%%",
			"data:image/png;base64,abc",
			btoa("not an image"),
		])
			expect(paymentProofImage(data)).toBeNull();
	});
	test("checks the size of the actual upload including base64 padding", () => {
		const bytes = `\xff\xd8\xff${"x".repeat(MAX_UPLOAD_BYTES - 3)}`;
		expect(paymentProofImage(btoa(bytes))?.mimeType).toBe("image/jpeg");
		expect(paymentProofImage(btoa(`${bytes}x`))).toBeNull();
	});
});
