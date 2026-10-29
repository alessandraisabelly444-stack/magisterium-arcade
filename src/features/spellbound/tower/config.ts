/** Tower arena configuration (world units = canvas pixels). */
export const TOWER_CONFIG = {
  width: 400,
  height: 720,
  cell: 24,
  platformWidth: 168,
  platformTop: 640,
  /** Target height in cells above the platform. */
  goalCells: 20,
  /** Displayed meta in meters. */
  goalMeters: 15,
  spawnY: 80,
  fallSpeed: 55,
  /** Same safe descent range the bots use — fast, but never enough to tunnel. */
  softDropSpeed: 190,
  moveStep: 12,
  maxLostPieces: 7,
  /** Seconds the tower must stay stable above the line to win. */
  winHoldSeconds: 5,
  /** Rabbit ability cooldown after a confirmed hit. */
  shurikenCooldownSeconds: 5,
  /** Time between confirming a target and removing it. */
  shurikenFlightSeconds: 0.36,
  /** Fox ability: freeze duration and cooldown. */
  freezeSeconds: 3,
  freezeCooldownSeconds: 6,
  /** Frog ability: max pull distance (px), drag speed (px/s) and cooldown. */
  tonguePull: 48,
  tonguePullSpeed: 360,
  tongueCooldownSeconds: 5,
  /** Raccoon ability: short forging sequence, warm-metal visual and cooldown. */
  forgeAnimationSeconds: 0.8,
  forgedHeatSeconds: 3,
  forgeCooldownSeconds: 10,
  /** Owl ability: global time-stop window and cooldown after the forecast is used. */
  timeVisionSeconds: 5,
  timeVisionCooldownSeconds: 10,
  timeVisionFadeSeconds: 0.4,
  /** Capybara ability: finer horizontal control for the next piece, then a short cooldown. */
  capybaraMarginMoveFactor: 0.6,
  capybaraMarginCooldownSeconds: 10,
  /** Axolotl passive: tolerate up to ten lost pieces before the usual loss condition. */
  axolotlMaxLostPieces: 10,
} as const;

export const FINISH_Y = TOWER_CONFIG.platformTop - TOWER_CONFIG.goalCells * TOWER_CONFIG.cell;

export const METERS_PER_PX = TOWER_CONFIG.goalMeters / (TOWER_CONFIG.goalCells * TOWER_CONFIG.cell);
