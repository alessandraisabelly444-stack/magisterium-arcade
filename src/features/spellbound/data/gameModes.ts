import type { ArcadeMinigameId } from "../types";

export interface MinigameModeCapabilities {
  singleplayer: boolean;
  multiplayer: boolean;
  bots: boolean;
  privateRoom: boolean;
}

/**
 * The mode catalog is the single source of truth for which play options each
 * minigame exposes. New games can opt into any combination without changing
 * the shared mode-selection UI.
 */
export const MINIGAME_MODE_CAPABILITIES = {
  "sky-flap": {
    singleplayer: true,
    multiplayer: true,
    bots: true,
    privateRoom: true,
  },
  "sky-run": {
    singleplayer: true,
    multiplayer: true,
    bots: true,
    privateRoom: true,
  },
  tower: {
    singleplayer: false,
    multiplayer: true,
    bots: true,
    privateRoom: true,
  },
  "spellbound-maze": {
    singleplayer: true,
    multiplayer: true,
    bots: true,
    privateRoom: true,
  },
} as const satisfies Record<ArcadeMinigameId, MinigameModeCapabilities>;

export type MinigameMode = keyof MinigameModeCapabilities;

export function supportsMinigameMode(gameId: ArcadeMinigameId, mode: MinigameMode) {
  return MINIGAME_MODE_CAPABILITIES[gameId][mode];
}
