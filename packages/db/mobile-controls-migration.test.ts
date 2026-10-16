import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("mobile publishing is seeded only from active explicit Super Admin permission", () => {
	const db = new Database(":memory:");
	try {
		db.exec(
			"CREATE TABLE user (id TEXT PRIMARY KEY, is_admin INTEGER, can_manage_pricing INTEGER, suspended_at INTEGER)",
		);
		db.exec(
			"INSERT INTO user VALUES ('super',1,1,NULL),('admin',1,0,NULL),('suspended',1,1,1),('former',0,1,NULL)",
		);
		db.exec(
			readFileSync(
				join(import.meta.dir, "migrations/0037_mobile_controls.sql"),
				"utf8",
			),
		);
		expect(
			db.query("SELECT id FROM user WHERE can_publish_mobile=1").all(),
		).toEqual([{ id: "super" }]);
		expect(
			db
				.query(
					"SELECT draft, published_revision_id FROM mobile_configuration_state",
				)
				.get(),
		).toEqual({ draft: null, published_revision_id: null });
	} finally {
		db.close();
	}
});
