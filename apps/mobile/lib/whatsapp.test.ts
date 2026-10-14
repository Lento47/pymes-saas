import { describe, expect, test } from "bun:test";

import { customerWhatsAppUrl } from "./whatsapp";

describe("customer WhatsApp link", () => {
	test("adds Costa Rica's country code to an eight-digit local number", () => {
		expect(customerWhatsAppUrl("8888-7777")).toBe("https://wa.me/50688887777");
	});

	test("keeps an international country code and removes display punctuation", () => {
		expect(customerWhatsAppUrl("+1 (415) 555-0123")).toBe(
			"https://wa.me/14155550123",
		);
		expect(customerWhatsAppUrl("+506 8888 7777")).toBe(
			"https://wa.me/50688887777",
		);
	});

	test("does not create a link without a usable number", () => {
		expect(customerWhatsAppUrl(null)).toBeNull();
		expect(customerWhatsAppUrl("123")).toBeNull();
	});
});
