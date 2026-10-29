import { getDatabase } from "@netlify/database";
import type { Context } from "@netlify/functions";

import { normalizePlayerName } from "../../src/features/spellbound/playerProfile";
import { jsonResponse } from "../../src/server/arcadeLeaderboard";

export const config = { path: "/api/leaderboard", method: "GET" };

interface RankingRow {
  position: number;
  name: string;
  points: number | string;
  coins: number | string;
  is_current_player: boolean;
}

export default async (request: Request, _context: Context) => {
  const requestedName = normalizePlayerName(new URL(request.url).searchParams.get("playerName"));
  const normalizedCurrentName = requestedName?.normalizedName ?? null;

  try {
    const db = getDatabase();
    const rows = await db.sql<RankingRow>`
      WITH points AS (
        SELECT
          normalized_name,
          display_name,
          coins_balance,
          (best_tower_height_tenths::BIGINT * 10
            + best_sky_flap::BIGINT
            + best_sky_run::BIGINT
            + best_maze::BIGINT) AS total_points
        FROM spellbound_arcade_players
        WHERE is_legacy_alias = FALSE
      ),
      ranked AS (
        SELECT
          ROW_NUMBER() OVER (
            ORDER BY total_points DESC, display_name ASC, normalized_name ASC
          ) AS position,
          normalized_name,
          display_name,
          total_points,
          coins_balance
        FROM points
      )
      SELECT
        position,
        display_name AS name,
        total_points AS points,
        coins_balance AS coins,
        (${normalizedCurrentName}::TEXT IS NOT NULL
          AND normalized_name = ${normalizedCurrentName}) AS is_current_player
      FROM ranked
      WHERE position <= 100
        OR (${normalizedCurrentName}::TEXT IS NOT NULL
          AND normalized_name = ${normalizedCurrentName})
      ORDER BY position
      LIMIT 101
    `;

    return jsonResponse({
      entries: rows.map((row) => ({
        position: Number(row.position),
        name: row.name,
        points: Number(row.points),
        coins: Number(row.coins),
        isCurrentPlayer: Boolean(row.is_current_player),
      })),
    });
  } catch {
    return jsonResponse(
      { error: "Não foi possível carregar o ranking agora. Tente novamente." },
      503,
    );
  }
};
