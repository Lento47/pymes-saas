-- The ledger of what each account holder agreed to, and when.
--
-- Created as its own table rather than two columns on `user` so the record can be
-- shown to the person it is about: under Ley 8968 Art. 5 consent has to be written
-- down, and Art. 6 of the Reglamento puts the burden of proving it on whoever
-- collected it. `user` is a row a reader never sees; this is a row whose only
-- subject is the agreement.
--
-- Both timestamps are NOT NULL. A row exists because an agreement was captured, so
-- there is no shape of this table that means "no agreement" — a missing row is that,
-- and a nullable timestamp inside an existing row would be a row claiming half an
-- agreement.
--
-- No backfill. Every row here is written by the `databaseHooks.user.create` pair in
-- packages/trpc-api/src/auth.ts, which refuses to create a user without both
-- assertions, so an account that predates the gate has no row and no row is
-- invented for it. Inventing one would assert a consent nobody gave.
--
-- `revoked_at` is nullable and normally stays null: Art. 5 makes consent revocable
-- "de la misma forma" it was granted, and a revocation that overwrote the grant
-- would leave nothing to point at.
CREATE TABLE `account_consent` (
	`user_id` text PRIMARY KEY NOT NULL,
	`terms_accepted_at` integer NOT NULL,
	`age_confirmed_at` integer NOT NULL,
	`revoked_at` integer,
	`revoked_reason` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
