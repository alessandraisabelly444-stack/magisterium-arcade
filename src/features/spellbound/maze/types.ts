import type { PlayableCharacterId } from "../types";

export type MazeMode = "solo" | "bots" | "local";
export type MazeBiomeId = "frost" | "shadow-garden" | "mosswood" | "forge" | "chronolibrary";
export type MazeDirection = "up" | "down" | "left" | "right";
export type MazeTile = "wall" | "path" | "breakable" | "special";
export type MazeItemKind = "crystal" | "rune" | "coin" | "power-rune";
export type MazeEnemyKind = "pursuer" | "interceptor" | "patroller" | "trickster";
export type MazeParticipantStatus = "active" | "finished" | "eliminated";
export type MazeMatchPhase =
  | "character-select"
  | "countdown"
  | "playing"
  | "level-clear"
  | "game-over"
  | "results"
  | "voting"
  | "decision"
  | "next-level"
  | "change-game";
export type MazePostMatchVote = "next-level" | "change-game";
export type MazeMatchEndReason = "all-inactive" | "time-limit";

export interface MazeCell {
  x: number;
  y: number;
}

export interface MazeBiomeDefinition {
  id: MazeBiomeId;
  name: string;
  subtitle: string;
  wall: string;
  wallLight: string;
  floor: string;
  floorAlt: string;
  accent: string;
  glow: string;
  special: string;
  specialName: string;
  specialRule: string;
}

export interface MazeItem {
  id: string;
  kind: MazeItemKind;
  x: number;
  y: number;
  collectedBy: string | null;
}

export interface MazeLayout {
  width: number;
  height: number;
  biome: MazeBiomeDefinition;
  grid: MazeTile[][];
  start: MazeCell;
  exit: MazeCell;
  playerSpawns: MazeCell[];
  ghostSpawns: MazeCell[];
  items: MazeItem[];
  targetCrystals: number;
  targetRunes: number;
  seed: number;
}

export interface MazeParticipantConfig {
  id: string;
  name: string;
  characterId: PlayableCharacterId;
  isBot?: boolean;
  botDifficulty?: "casual" | "balanced" | "skilled";
  controlIndex?: number;
  roster?: PlayableCharacterId[];
}

export interface MazePlayerSnapshot {
  id: string;
  name: string;
  characterId: PlayableCharacterId;
  roster: PlayableCharacterId[];
  activeCharacterSlot: number;
  rosterConfirmed: boolean;
  switchCooldownSeconds: number;
  teleportTarget: MazeCell | null;
  teleportTargetValid: boolean;
  isBot: boolean;
  controlIndex: number;
  x: number;
  y: number;
  direction: MazeDirection;
  isMoving: boolean;
  lives: number;
  score: number;
  crystals: number;
  runes: number;
  coinsCollected: number;
  powerRunes: number;
  powerWarningSeconds: number;
  ghostsDefeated: number;
  combo: number;
  abilityCooldowns: Record<PlayableCharacterId, number>;
  abilityCooldownSeconds: number;
  abilityActiveSeconds: number;
  status: MazeParticipantStatus;
  eliminationOrder: number | null;
  finishOrder: number | null;
  finishTimeSeconds: number | null;
  invulnerableSeconds: number;
}

export interface MazeGhostSnapshot {
  id: string;
  kind: MazeEnemyKind;
  x: number;
  y: number;
  direction: MazeDirection;
  stunnedSeconds: number;
  frozenSeconds: number;
  timeStoppedSeconds: number;
  fleeingSeconds: number;
  slowedSeconds: number;
  calmariaSeconds: number;
}

export interface MazeSwampZoneSnapshot {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  cells: MazeCell[];
  secondsRemaining: number;
  maxSeconds: number;
}

export interface MazeProjectileSnapshot {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  direction: MazeDirection;
  remainingDistance: number;
}

export interface MazeEffectSnapshot {
  id: string;
  kind:
    | "ice-ray"
    | "ice-burst"
    | "root-tether"
    | "forge-impact"
    | "time-vision"
    | "time-stop"
    | "swamp-burst"
    | "fire-burst"
    | "teleport-smoke"
    | "character-swap"
    | "hit"
    | "gate-open";
  x: number;
  y: number;
  direction: MazeDirection;
  secondsRemaining: number;
  maxSeconds: number;
  targetX?: number;
  targetY?: number;
}

export interface MazeSnapshot {
  phase: MazeMatchPhase;
  countdownLabel: string | null;
  level: number;
  cycle: number;
  levelInCycle: number;
  biome: MazeBiomeDefinition;
  width: number;
  height: number;
  grid: MazeTile[][];
  exit: MazeCell;
  exitOpen: boolean;
  items: MazeItem[];
  players: MazePlayerSnapshot[];
  ranking: MazePlayerSnapshot[];
  ghosts: MazeGhostSnapshot[];
  projectiles: MazeProjectileSnapshot[];
  effects: MazeEffectSnapshot[];
  swampZones: MazeSwampZoneSnapshot[];
  collectiblesCollected: number;
  collectiblesTotal: number;
  crystalsCollected: number;
  runesActivated: number;
  targetCrystals: number;
  targetRunes: number;
  elapsedSeconds: number;
  matchElapsedSeconds: number;
  ghostsDefeated: number;
  globalTimeStopSeconds: number;
  timeNormalDisplaySeconds: number;
  winnerId: string | null;
  matchEndReason: MazeMatchEndReason | null;
  gameOverScore: number;
  gameOverBestScore: number;
  gameOverLevel: number;
  gameOverGhostsDefeated: number;
  gameOverReason: string | null;
  matchTotalSeconds: number;
  votingSecondsRemaining: number;
  decisionSecondsRemaining: number;
  voteCounts: Record<MazePostMatchVote, number>;
  humanVoterCount: number;
  votedPlayerIds: string[];
  voteDecision: MazePostMatchVote | null;
}
