import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const signIn = readFileSync(
	join(import.meta.dir, "..", "app", "(auth)", "sign-in.tsx"),
	"utf8",
);
const actionBar = readFileSync(
	join(import.meta.dir, "..", "components", "action-bar.tsx"),
	"utf8",
);

describe("sign-in submit stays on screen", () => {
	test("the action bar is not unmounted while the keyboard is open", () => {
		expect(signIn).toContain("<ActionBar");
		expect(signIn).not.toContain("keyboardVisible");
		expect(signIn).not.toContain("!keyboardVisible");
	});

	test("a docked action bar lifts by keyboard height", () => {
		expect(actionBar).toContain("useKeyboardState");
		expect(actionBar).toContain("Math.max(insets.bottom, keyboardHeight)");
	});
});
