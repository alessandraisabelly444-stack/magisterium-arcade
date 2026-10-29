export const GROUND_Y = 430;

export const SKY_RUN_CONFIG = {
  width: 960,
  height: 540,
  groundY: GROUND_Y,
  playerX: 220,
  playerHitWidth: 28,
  playerSpriteWidth: 60,
  playerSpriteHeight: 60,
  multiplayerPlayerSpriteSize: 48,
  gravity: 1400,
  jumpImpulse: 470,
  maxFallSpeed: 700,
  baseRunSpeed: 270,
  distancePerPoint: 12,
  firstObstacleX: 650,
  minObstacleSpacing: 390,
  maxObstacleSpacing: 460,
  spawnAhead: 520,
  maxObstacles: 4,
  maxSpeedMultiplier: 1.18,
  speedMultiplierIncreasePerPoint: 0.00003,
  speedMultiplierIncreasePerCycle: 0.03,
  worldSegmentDistance: 10_800,
  worldTransitionDurationSeconds: 2.2,
  jumpEffectDurationMs: 300,
  collisionEffectDurationMs: 520,
} as const;

export const SKY_RUN_WORLD_NAMES = [
  "CÉU ENCANTADO",
  "FLORESTA ENCANTADA",
  "RUÍNAS MÁGICAS",
  "REINO DE GELO",
  "DIMENSÃO ARCANA",
  "MUNDO DOCE",
] as const;

export const SKY_RUN_MAP_COUNT = SKY_RUN_WORLD_NAMES.length;
export const SKY_RUN_TOTAL_DISTANCE = SKY_RUN_CONFIG.worldSegmentDistance * SKY_RUN_MAP_COUNT;
