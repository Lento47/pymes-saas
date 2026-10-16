import { describe, expect, test } from "bun:test";
import { compactCapsuleAt, createTabScrollState } from "./tab-scroll-state";

describe("scrolling navigation capsule", () => {
	test("shrinks after leaving the top and expands when the reader returns", () => {
		expect(compactCapsuleAt(20, false)).toBe(false);
		expect(compactCapsuleAt(100, false)).toBe(true);
		expect(compactCapsuleAt(20, true)).toBe(true);
		expect(compactCapsuleAt(0, true)).toBe(false);
	});

	test("pull-to-refresh bounce and invalid offsets cannot leave the bar stuck", () => {
		expect(compactCapsuleAt(-40, true)).toBe(false);
		expect(compactCapsuleAt(Number.NaN, false)).toBe(false);
		expect(compactCapsuleAt(Number.POSITIVE_INFINITY, true)).toBe(true);
	});

	test("background scroll and late blur events cannot change the focused tab", () => {
		const state = createTabScrollState();
		const home = Symbol("home");
		const orders = Symbol("orders");
		state.activate(home, true);
		state.activate(orders, false);
		state.update(home, true);
		state.deactivate(home);
		expect(state.getSnapshot()).toBe(false);
		state.update(orders, true);
		expect(state.getSnapshot()).toBe(true);
	});

	test("returning to a scrolled tab restores its size; leaving resets the bar", () => {
		const state = createTabScrollState();
		const home = Symbol("home");
		state.activate(home, true);
		state.deactivate(home);
		expect(state.getSnapshot()).toBe(false);
		state.activate(home, true);
		expect(state.getSnapshot()).toBe(true);
		state.update(home, false);
		expect(state.getSnapshot()).toBe(false);
	});

	test("only size changes notify the bar and subscriptions clean up", () => {
		const state = createTabScrollState();
		const home = Symbol("home");
		let updates = 0;
		const unsubscribe = state.subscribe(() => updates++);
		state.activate(home, false);
		state.update(home, true);
		state.update(home, true);
		expect(updates).toBe(1);
		unsubscribe();
		state.deactivate(home);
		expect(updates).toBe(1);
	});
});
