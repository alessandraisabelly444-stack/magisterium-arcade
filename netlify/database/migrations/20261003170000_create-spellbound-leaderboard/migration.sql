CREATE TABLE IF NOT EXISTS spellbound_arcade_players (
  user_id TEXT PRIMARY KEY,
  display_name VARCHAR(18) NOT NULL,
  best_tower_height_tenths INTEGER NOT NULL DEFAULT 0 CHECK (best_tower_height_tenths >= 0),
  best_sky_flap INTEGER NOT NULL DEFAULT 0 CHECK (best_sky_flap >= 0),
  best_sky_run INTEGER NOT NULL DEFAULT 0 CHECK (best_sky_run >= 0),
  best_maze INTEGER NOT NULL DEFAULT 0 CHECK (best_maze >= 0),
  coins_balance BIGINT NOT NULL DEFAULT 0 CHECK (coins_balance >= 0),
  legacy_seeded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS spellbound_arcade_ranking_idx
  ON spellbound_arcade_players (
    (best_tower_height_tenths::BIGINT * 10
      + best_sky_flap::BIGINT
      + best_sky_run::BIGINT
      + best_maze::BIGINT) DESC,
    display_name ASC
  );

CREATE TABLE IF NOT EXISTS spellbound_arcade_coin_events (
  user_id TEXT NOT NULL REFERENCES spellbound_arcade_players(user_id) ON DELETE CASCADE,
  event_id VARCHAR(128) NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);
