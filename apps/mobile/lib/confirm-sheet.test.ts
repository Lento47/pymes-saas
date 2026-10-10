import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const confirm = readFileSync(
	join(import.meta.dir, "..", "components", "confirm-sheet.tsx"),
	"utf8",
);
const account = readFileSync(
	join(import.meta.dir, "..", "app", "account.tsx"),
	"utf8",
);

describe("confirm and sign-out panels", () => {
	test("questions arrive on the dialog curve rather than a bouncing spring", () => {
		expect(confirm).toContain('variant="dialog"');
	});

	test("the consumer hub reuses SignOutSheet", () => {
		expect(account).toContain("<SignOutSheet");
		expect(account).toContain("requestSignOutNavigation");
		expect(account).not.toContain("<ConfirmSheet");
	});
});
