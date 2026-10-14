import { describe, expect, mock, test } from "bun:test";

const stored = new Map<string, string>();
let failRead = false;

mock.module("@react-native-async-storage/async-storage", () => ({
	default: {
		getItem: async (key: string) => {
			if (failRead) throw new Error("storage unavailable");
			return stored.get(key) ?? null;
		},
		setItem: async (key: string, value: string) => {
			stored.set(key, value);
		},
	},
}));

const { hasSeenMerchantGuide, markMerchantGuideSeen } = await import(
	"./merchant-guide"
);

describe("merchant guide completion", () => {
	test("keeps completion per business in device storage", async () => {
		expect(await hasSeenMerchantGuide("shop-a")).toBe(false);
		await markMerchantGuideSeen("shop-a");
		expect(await hasSeenMerchantGuide("shop-a")).toBe(true);
		expect(await hasSeenMerchantGuide("shop-b")).toBe(false);
		expect(stored.get("pymeshub_merchant_guide_v1:shop-a")).toBe("1");
	});

	test("allows one opening when storage cannot be read", async () => {
		failRead = true;
		try {
			expect(await hasSeenMerchantGuide("shop-offline")).toBe(false);
			expect(await hasSeenMerchantGuide("shop-offline")).toBe(true);
		} finally {
			failRead = false;
		}
	});
});
