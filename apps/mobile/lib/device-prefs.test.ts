import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
	getAccountProfile,
	setAccountProfile,
	subscribeAccountProfile,
} from "./device-prefs";

describe("account profile subscriptions", () => {
	beforeEach(async () => {
		await setAccountProfile("customer");
	});

	test("publishes a changed role once and stops after unsubscribe", async () => {
		const listener = mock(() => {});
		const unsubscribe = subscribeAccountProfile(listener);

		await setAccountProfile("delivery");
		await setAccountProfile("delivery");

		expect(getAccountProfile()).toBe("delivery");
		expect(listener).toHaveBeenCalledTimes(1);

		unsubscribe();
		await setAccountProfile("business");
		expect(listener).toHaveBeenCalledTimes(1);
	});
});
