import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pressable = readFileSync(
	join(import.meta.dir, "..", "components", "pressable.tsx"),
	"utf8",
);

describe("pressable press overlay", () => {
	test("press feedback is clipped to the caller's corner, not a square mask", () => {
		expect(pressable).toContain('overflow: "hidden"');
		expect(pressable).toContain("function pressOutline(");
		expect(pressable).toContain("StyleSheet.flatten(resolved)");
		// The default radius must not override the caller's pill or card outline.
		expect(pressable).not.toContain(
			"style={[styles.base, { borderRadius: radius.sm }, animated, resolved]}",
		);
	});

	test("a lift is not clipped by the same layer that contains the highlight", () => {
		expect(pressable).toContain("function hasShadow(");
		expect(pressable).toContain("function splitPressStyle(");
		expect(pressable).toContain("if (!hasShadow(flat))");
	});
});
