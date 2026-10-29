import { getActivePlayerName, normalizePlayerName } from "../playerProfile";

export type GlobalGame = "tower" | "sky-flap" | "sky-run" | "maze";

export interface GlobalLeaderboardEntry {
  position: number;
  name: string;
  points: number;
  coins: number;
  isCurrentPlayer: boolean;
}

export interface GlobalLeaderboardResponse {
  entries: GlobalLeaderboardEntry[];
}

export const LEADERBOARD_UPDATED_EVENT = "spellbound:leaderboard-updated";

async function postJson(path: string, payload: unknown) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: unknown } | null;
    const message =
      typeof detail?.error === "string" ? detail.error : "A operação não foi concluída.";
    throw new Error(message);
  }
  return response.json().catch(() => ({})) as Promise<unknown>;
}

async function postJsonWithRetry(path: string, payload: unknown) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await postJson(path, payload);
    } catch (error) {
      lastError = error;
      if (attempt < 2)
        await new Promise((resolve) => window.setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("A operação não foi concluída.");
}

export async function fetchGlobalLeaderboard(
  playerName: string,
): Promise<GlobalLeaderboardResponse> {
  const parsedName = normalizePlayerName(playerName);
  if (!parsedName) throw new Error("Informe um nome para carregar o ranking.");
  const query = new URLSearchParams({ playerName: parsedName.displayName });
  const response = await fetch(`/api/leaderboard?${query.toString()}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: unknown } | null;
    const message =
      typeof detail?.error === "string" ? detail.error : "Não foi possível carregar o ranking.";
    throw new Error(message);
  }
  return (await response.json()) as GlobalLeaderboardResponse;
}

export async function submitGlobalRecord(game: GlobalGame, score: number) {
  const playerName = getActivePlayerName();
  if (!playerName || !Number.isSafeInteger(score) || score <= 0) return false;
  try {
    await postJsonWithRetry("/api/leaderboard/score", { game, score, playerName });
    if (typeof window !== "undefined") window.dispatchEvent(new Event(LEADERBOARD_UPDATED_EVENT));
    return true;
  } catch {
    // Local records remain available when the network is temporarily unavailable.
    return false;
  }
}

export async function syncGlobalCoinReward(
  matchId: string,
  amount: number,
  playerName = getActivePlayerName(),
) {
  if (!playerName || !matchId || !Number.isSafeInteger(amount) || amount <= 0) return;
  try {
    await postJsonWithRetry("/api/leaderboard/coins", { matchId, amount, playerName });
    if (typeof window !== "undefined") window.dispatchEvent(new Event(LEADERBOARD_UPDATED_EVENT));
  } catch {
    // Local coin settlement is authoritative for play; global sync remains best-effort/idempotent.
  }
}

export function subscribeToLeaderboardUpdates(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(LEADERBOARD_UPDATED_EVENT, listener);
  return () => window.removeEventListener(LEADERBOARD_UPDATED_EVENT, listener);
}
