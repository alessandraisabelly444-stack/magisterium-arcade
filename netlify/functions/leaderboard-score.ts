import type { Context } from "@netlify/functions";

import {
  boundedInteger,
  ensureLeaderboardPlayerByName,
  isJsonObject,
  isSameOriginRequest,
  jsonResponse,
  MAX_RECORD_SCORE,
} from "../../src/server/arcadeLeaderboard";
import { normalizePlayerName } from "../../src/features/spellbound/playerProfile";

export const config = { path: "/api/leaderboard/score", method: "POST" };

export default async (request: Request, _context: Context) => {
  if (!isSameOriginRequest(request)) {
    return jsonResponse({ error: "Origem da solicitação inválida." }, 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Recorde inválido." }, 400);
  }
  if (!isJsonObject(body)) return jsonResponse({ error: "Recorde inválido." }, 400);

  const playerName = normalizePlayerName(body["playerName"]);
  if (!playerName)
    return jsonResponse({ error: "Digite um nome válido para salvar o recorde." }, 400);

  const game = body["game"];
  if (game !== "tower" && game !== "sky-flap" && game !== "sky-run" && game !== "maze") {
    return jsonResponse({ error: "Jogo inválido." }, 400);
  }
  const score = boundedInteger(body["score"], MAX_RECORD_SCORE);
  if (score <= 0) return jsonResponse({ error: "O recorde deve ser maior que zero." }, 400);

  try {
    const player = await ensureLeaderboardPlayerByName(playerName.displayName);
    let updatedRows: unknown[];
    if (game === "tower") {
      updatedRows = await player.db.sql`
        UPDATE spellbound_arcade_players
        SET best_tower_height_tenths = GREATEST(best_tower_height_tenths, ${score}),
            updated_at = NOW()
        WHERE user_id = ${player.userId} AND is_legacy_alias = FALSE
          AND best_tower_height_tenths < ${score}
        RETURNING user_id
      `;
    } else if (game === "sky-flap") {
      updatedRows = await player.db.sql`
        UPDATE spellbound_arcade_players
        SET best_sky_flap = GREATEST(best_sky_flap, ${score}), updated_at = NOW()
        WHERE user_id = ${player.userId} AND is_legacy_alias = FALSE
          AND best_sky_flap < ${score}
        RETURNING user_id
      `;
    } else if (game === "sky-run") {
      updatedRows = await player.db.sql`
        UPDATE spellbound_arcade_players
        SET best_sky_run = GREATEST(best_sky_run, ${score}), updated_at = NOW()
        WHERE user_id = ${player.userId} AND is_legacy_alias = FALSE
          AND best_sky_run < ${score}
        RETURNING user_id
      `;
    } else {
      updatedRows = await player.db.sql`
        UPDATE spellbound_arcade_players
        SET best_maze = GREATEST(best_maze, ${score}), updated_at = NOW()
        WHERE user_id = ${player.userId} AND is_legacy_alias = FALSE
          AND best_maze < ${score}
        RETURNING user_id
      `;
    }
    return jsonResponse({ ok: true, updated: updatedRows.length > 0 });
  } catch {
    return jsonResponse(
      { error: "Não foi possível salvar o recorde agora. Tente novamente." },
      503,
    );
  }
};
