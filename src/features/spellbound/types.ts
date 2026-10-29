export type SpellboundView =
  | "name-entry"
  | "lobby"
  | "characters"
  | "tower"
  | "tower-local"
  | "sky-flap"
  | "sky-flap-solo"
  | "sky-flap-multiplayer"
  | "sky-flap-bots"
  | "multiplayer-menu"
  | "sky-run-modes"
  | "sky-run"
  | "sky-run-multiplayer"
  | "sky-run-local"
  | "maze-modes"
  | "maze-solo"
  | "maze-bots"
  | "maze-local";

export type ArcadeMinigameId = "sky-flap" | "sky-run" | "tower" | "spellbound-maze";

export type LobbyOptionId =
  "tower" | "sky-flap" | "sky-run" | "spellbound-maze" | "characters" | "customize" | "leaderboard";

export type PlayableCharacterId =
  | "white-fox-ice-mage"
  | "purple-rabbit-ninja"
  | "swamp-frog-mage"
  | "forge-raccoon-mage"
  | "time-owl-mage"
  | "calm-capybara-mage"
  | "axolotl-mage";

export interface PlayableCharacterSeed {
  id: PlayableCharacterId;
  name: string;
  shortName: string;
  theme: string;
  magicLabel: string;
  description: string;
  dominantColor: string;
  badgeClassName: string;
  sprite: string;
  coinCost?: number;
  /** Reserved for future systems (abilities, mechanics). Not used yet. */
  abilityIds?: string[];
}

export interface LobbyOption {
  id: LobbyOptionId;
  label: string;
  description: string;
  accentClassName: string;
}
