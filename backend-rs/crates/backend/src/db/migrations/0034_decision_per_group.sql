-- Decision-model scenarios move from the account to the group.
--
-- The endpoint, key, model and confidence floor stay on `system_settings`:
-- they are a credential, shared like a provider. Whether the model is used,
-- and for which scenarios, is a per-group choice, because the same owner
-- runs groups with very different stakes (a brainstorming room and a repo
-- with shell access). The account-level switches are dropped rather than
-- left behind so a stale global "on" cannot silently re-enable anything.
ALTER TABLE groups
ADD COLUMN decision_enabled INTEGER NOT NULL DEFAULT 0
  CHECK (decision_enabled IN (0, 1));
ALTER TABLE groups
ADD COLUMN decision_scenarios_json TEXT NOT NULL DEFAULT '{}';

ALTER TABLE system_settings DROP COLUMN decision_enabled;
ALTER TABLE system_settings DROP COLUMN decision_scenarios_json;
