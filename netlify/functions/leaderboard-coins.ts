import type { Context } from "@netlify/functions";

import {
  boundedInteger,
  ensureLeaderboardPlayerByName,
  isJsonObject,
  isSameOriginRequest,
  jsonResponse,
} from "../../src/server/arcadeLeaderboard";
import { normalizePlayerName } from "../../src/features/spellbound/playerProfile";

export const config = { path: "/api/leaderboard/coins", method: "POST" };

const MAX_MATCH_REWARD = 10_000_000;

export default async (request: Request, _context: Context) => {
  if (!isSameOriginRequest(request)) {
    return jsonResponse({ error: "Origem da solicitação inválida." }, 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Recompensa inválida." }, 400);
  }
  if (!isJsonObject(body)) return jsonResponse({ error: "Recompensa inválida." }, 400);

  const playerName = normalizePlayerName(body["playerName"]);
  if (!playerName)
    return jsonResponse({ error: "Digite um nome válido para sincronizar moedas." }, 400);

  const matchId = body["matchId"];
  if (typeof matchId !== "string" || !/^[a-zA-Z0-9:_-]{1,120}$/.test(matchId)) {
    return jsonResponse({ error: "Identificador de partida inválido." }, 400);
  }
  const amount = boundedInteger(body["amount"], MAX_MATCH_REWARD);
  if (amount <= 0) return jsonResponse({ error: "Recompensa inválida." }, 400);

  try {
    const player = await ensureLeaderboardPlayerByName(playerName.displayName);
    const eventId = `${matchId}:primary`;
    await player.db.sql`
      WITH inserted_event AS (
        INSERT INTO spellbound_arcade_coin_events (user_id, event_id, amount)
        VALUES (${player.userId}, ${eventId}, ${amount})
        ON CONFLICT (user_id, event_id) DO NOTHING
        RETURNING amount
      )
      UPDATE spellbound_arcade_players AS profile
      SET coins_balance = profile.coins_balance + inserted_event.amount,
          updated_at = NOW()
      FROM inserted_event
      WHERE profile.user_id = ${player.userId}
        AND profile.is_legacy_alias = FALSE
    `;
    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse(
      { error: "Não foi possível sincronizar moedas agora. Tente novamente." },
      503,
    );
  }
};
