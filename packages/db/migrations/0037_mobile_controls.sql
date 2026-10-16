ALTER TABLE user ADD COLUMN can_publish_mobile INTEGER NOT NULL DEFAULT 0;
-- pricing.manage is the existing explicit Super Admin capability, not general admin access.
UPDATE user SET can_publish_mobile = 1
WHERE is_admin = 1 AND can_manage_pricing = 1 AND suspended_at IS NULL;

CREATE TABLE mobile_configuration_state (
 id TEXT PRIMARY KEY NOT NULL CHECK (id = 'mobile'),
 draft_version INTEGER NOT NULL DEFAULT 0,
 draft TEXT CHECK (draft IS NULL OR json_valid(draft)),
 published_revision_id TEXT,
 updated_by_user_id TEXT REFERENCES user(id),
 updated_at INTEGER NOT NULL
);
CREATE TABLE mobile_configuration_revision (
 id TEXT PRIMARY KEY NOT NULL,
 revision INTEGER NOT NULL UNIQUE,
 previous_revision_id TEXT,
 expected_draft_version INTEGER NOT NULL,
 configuration TEXT NOT NULL CHECK (json_valid(configuration)),
 published_by_user_id TEXT NOT NULL REFERENCES user(id),
 reason TEXT NOT NULL,
 restored_from_id TEXT REFERENCES mobile_configuration_revision(id),
 created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX mobile_revision_parent ON mobile_configuration_revision(COALESCE(previous_revision_id, 'initial'));
CREATE TRIGGER mobile_revision_current_head BEFORE INSERT ON mobile_configuration_revision
WHEN NOT EXISTS (
 SELECT 1 FROM mobile_configuration_state
 WHERE id='mobile' AND draft_version=NEW.expected_draft_version
 AND published_revision_id IS NEW.previous_revision_id
)
BEGIN SELECT RAISE(ABORT, 'mobile_configuration_conflict'); END;
CREATE TRIGGER mobile_revision_immutable BEFORE UPDATE ON mobile_configuration_revision
BEGIN SELECT RAISE(ABORT, 'Published mobile configuration is immutable'); END;
CREATE TRIGGER mobile_revision_retained BEFORE DELETE ON mobile_configuration_revision
BEGIN SELECT RAISE(ABORT, 'Published mobile history must be retained'); END;
INSERT INTO mobile_configuration_state (id, updated_at) VALUES ('mobile', 0);
