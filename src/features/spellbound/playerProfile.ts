export const ACTIVE_PLAYER_PROFILE_KEY = "spellbound-arcade-active-player-v1";
export const MAX_PLAYER_NAME_LENGTH = 18;

export interface NormalizedPlayerName {
  displayName: string;
  normalizedName: string;
}

let activePlayerNameInMemory: string | null = null;

export function normalizePlayerName(value: unknown): NormalizedPlayerName | null {
  if (typeof value !== "string") return null;
  const displayName = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const length = Array.from(displayName).length;
  if (length === 0 || length > MAX_PLAYER_NAME_LENGTH) return null;

  return {
    displayName,
    normalizedName: displayName.toLocaleLowerCase("pt-BR"),
  };
}

export function getActivePlayerName() {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(ACTIVE_PLAYER_PROFILE_KEY);
      const parsed = normalizePlayerName(stored);
      if (parsed) return parsed.displayName;
    } catch {
      // In-memory identity keeps the current page usable when browser storage is unavailable.
    }
  }
  return activePlayerNameInMemory;
}

export function setActivePlayerName(value: string | null) {
  const parsed = value === null ? null : normalizePlayerName(value);
  activePlayerNameInMemory = parsed?.displayName ?? null;
  if (typeof window === "undefined") return;
  try {
    if (parsed) window.localStorage.setItem(ACTIVE_PLAYER_PROFILE_KEY, parsed.displayName);
    else window.localStorage.removeItem(ACTIVE_PLAYER_PROFILE_KEY);
  } catch {
    // The selected player remains available in memory for this page.
  }
}
