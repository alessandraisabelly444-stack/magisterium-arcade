ALTER TABLE spellbound_arcade_players
  ADD COLUMN IF NOT EXISTS normalized_name TEXT,
  ADD COLUMN IF NOT EXISTS is_legacy_alias BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS canonical_user_id TEXT,
  ADD COLUMN IF NOT EXISTS legacy_merge_applied BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE spellbound_arcade_players
SET normalized_name = CASE
  WHEN btrim(regexp_replace(normalize(display_name, NFKC), '[[:space:]]+', ' ', 'g')) = ''
    THEN 'legacy-' || user_id
  ELSE lower(btrim(regexp_replace(normalize(display_name, NFKC), '[[:space:]]+', ' ', 'g')))
END
WHERE normalized_name IS NULL;

WITH ranked AS (
  SELECT
    user_id,
    normalized_name,
    FIRST_VALUE(user_id) OVER (
      PARTITION BY normalized_name
      ORDER BY created_at ASC, user_id ASC
    ) AS canonical_user_id,
    ROW_NUMBER() OVER (
      PARTITION BY normalized_name
      ORDER BY created_at ASC, user_id ASC
    ) AS duplicate_rank,
    MAX(best_tower_height_tenths) OVER (PARTITION BY normalized_name) AS best_tower_height_tenths,
    MAX(best_sky_flap) OVER (PARTITION BY normalized_name) AS best_sky_flap,
    MAX(best_sky_run) OVER (PARTITION BY normalized_name) AS best_sky_run,
    MAX(best_maze) OVER (PARTITION BY normalized_name) AS best_maze,
    SUM(coins_balance) OVER (PARTITION BY normalized_name) AS merged_coins_balance
  FROM spellbound_arcade_players
  WHERE is_legacy_alias = FALSE
)
UPDATE spellbound_arcade_players AS canonical
SET best_tower_height_tenths = ranked.best_tower_height_tenths,
    best_sky_flap = ranked.best_sky_flap,
    best_sky_run = ranked.best_sky_run,
    best_maze = ranked.best_maze,
    coins_balance = ranked.merged_coins_balance,
    legacy_merge_applied = TRUE
FROM ranked
WHERE canonical.user_id = ranked.canonical_user_id
  AND ranked.duplicate_rank = 1
  AND canonical.legacy_merge_applied = FALSE;

WITH ranked AS (
  SELECT
    user_id,
    FIRST_VALUE(user_id) OVER (
      PARTITION BY normalized_name
      ORDER BY created_at ASC, user_id ASC
    ) AS canonical_user_id,
    ROW_NUMBER() OVER (
      PARTITION BY normalized_name
      ORDER BY created_at ASC, user_id ASC
    ) AS duplicate_rank
  FROM spellbound_arcade_players
  WHERE is_legacy_alias = FALSE
)
UPDATE spellbound_arcade_players AS legacy_alias
SET is_legacy_alias = TRUE,
    canonical_user_id = ranked.canonical_user_id
FROM ranked
WHERE legacy_alias.user_id = ranked.user_id
  AND ranked.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS spellbound_arcade_active_normalized_name_idx
  ON spellbound_arcade_players (normalized_name)
  WHERE is_legacy_alias = FALSE;

CREATE INDEX IF NOT EXISTS spellbound_arcade_legacy_alias_canonical_idx
  ON spellbound_arcade_players (canonical_user_id)
  WHERE is_legacy_alias = TRUE;
