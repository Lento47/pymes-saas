import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pressable = readFileSync(
	join(import.meta.dir, "..", "components", "pressable.tsx"),
	"utf8",
);

describe("pressable press overlay", () => {
	test("the ripple is a foreground clipped to the caller's corner, not a square mask", () => {
		expect(pressable).toContain("foreground: true");
		expect(pressable).toContain("borderless: false");
		expect(pressable).toContain('overflow: "hidden"');
		expect(pressable).toContain("function pressOutline(");
		expect(pressable).toContain("StyleSheet.flatten(resolved)");
		// The default sm radius must not be applied *before* the caller and left as
		// the outline Android uses — that is the blank square on a pill or lg tile.
		expect(pressable).not.toContain(
			"style={[styles.base, { borderRadius: radius.sm }, animated, resolved]}",
		);
	});

	test("a lift is not clipped by the same layer that hides the ripple", () => {
		expect(pressable).toContain("function hasShadow(");
		expect(pressable).toContain("function splitPressStyle(");
		expect(pressable).toContain("if (!hasShadow(flat))");
	});
});
