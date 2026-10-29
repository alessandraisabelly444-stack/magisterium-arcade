import { getDatabase } from "@netlify/database";

import { normalizePlayerName } from "../features/spellbound/playerProfile";

export const MAX_RECORD_SCORE = 1_000_000_000;

export function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function boundedInteger(value: unknown, maximum = MAX_RECORD_SCORE) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return 0;
  return Math.min(value, maximum);
}

export async function ensureLeaderboardPlayerByName(value: unknown) {
  const profile = normalizePlayerName(value);
  if (!profile) throw new Error("Digite um nome válido.");

  const db = getDatabase();
  const profileId = `name:${profile.normalizedName}`;
  const rows = await db.sql<{ user_id: string; display_name: string }>`
    INSERT INTO spellbound_arcade_players (user_id, normalized_name, display_name)
    VALUES (${profileId}, ${profile.normalizedName}, ${profile.displayName})
    ON CONFLICT (normalized_name) WHERE (is_legacy_alias = FALSE) DO UPDATE
      SET updated_at = NOW()
    RETURNING user_id, display_name
  `;
  const player = rows[0];
  if (!player) throw new Error("Não foi possível salvar os dados do ranking.");
  return {
    db,
    userId: player.user_id,
    displayName: player.display_name,
    normalizedName: profile.normalizedName,
  };
}
