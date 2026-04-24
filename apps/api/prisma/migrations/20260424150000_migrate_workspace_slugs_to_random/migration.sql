-- Migrate workspace slugs to random base64url identifiers
DO $$
DECLARE
  v_workspace_id TEXT;
  v_new_slug TEXT;
  v_count INT;
  v_attempts INT;
BEGIN
  FOR v_workspace_id IN SELECT id FROM workspaces ORDER BY id
  LOOP
    v_attempts := 0;
    -- Generate random base64url slug until we find a unique one
    LOOP
      v_attempts := v_attempts + 1;
      IF v_attempts > 100 THEN
        RAISE EXCEPTION 'Could not generate unique slug after 100 attempts for workspace %', v_workspace_id;
      END IF;

      v_new_slug := REPLACE(REPLACE(RTRIM(ENCODE(random_bytes(9), 'base64'), '='), '+', '-'), '/', '_');
      SELECT COUNT(*) INTO v_count FROM workspaces WHERE slug = v_new_slug;
      EXIT WHEN v_count = 0; -- Slug is unique
    END LOOP;

    -- Update the workspace with the new slug
    UPDATE workspaces SET slug = v_new_slug WHERE id = v_workspace_id;
  END LOOP;
END
$$;
