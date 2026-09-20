-- A System One decision model (TypeSafe Jev, reached directly or through
-- OpenRouter's /api/alpha/decisions) that makes fast, typed judgments in front
-- of expensive or risky steps: picking a speaker, ending an automatic turn,
-- skipping proactive members with nothing to add, second-guessing a shell
-- command, suggesting a skill, validating a note's status, and reading a
-- reply's outcome.
--
-- Everything is off by default. Each call sends conversation excerpts to the
-- configured endpoint, so the owner opts in globally and then per scenario.
-- `decision_scenarios_json` holds one boolean per scenario name; a missing key
-- reads as off, so a newer build can add scenarios without a migration.
ALTER TABLE system_settings
ADD COLUMN decision_enabled INTEGER NOT NULL DEFAULT 0
  CHECK (decision_enabled IN (0, 1));
ALTER TABLE system_settings
ADD COLUMN decision_endpoint TEXT NOT NULL DEFAULT 'https://openrouter.ai/api/alpha/decisions';
ALTER TABLE system_settings
ADD COLUMN decision_api_key TEXT;
ALTER TABLE system_settings
ADD COLUMN decision_model TEXT NOT NULL DEFAULT '~typesafe/jev-latest';
ALTER TABLE system_settings
ADD COLUMN decision_min_confidence REAL NOT NULL DEFAULT 0.7
  CHECK (decision_min_confidence >= 0 AND decision_min_confidence <= 1);
ALTER TABLE system_settings
ADD COLUMN decision_scenarios_json TEXT NOT NULL DEFAULT '{}';
