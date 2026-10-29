import { SKY_RUN_CONFIG as C, SKY_RUN_TOTAL_DISTANCE, SKY_RUN_WORLD_NAMES } from "./config";

export type SkyRunPhase = "ready" | "playing" | "gameover";
export type SkyRunInputResult = "started" | "jumped" | "ignored";
export type SkyRunObstacleKind =
  | "crystal"
  | "rune-pillar"
  | "cloud-stone"
  | "lollipop"
  | "chocolate-bar"
  | "cookie-block"
  | "sugar-crystal"
  | "marshmallow-stack"
  | "cupcake";
export type SkyRunObjectType =
  "GROUND_OBSTACLE" | "FLOATING_OBSTACLE" | "AIR_OBSTACLE" | "DECORATION";

export interface SkyRunObstacle {
  id: number;
  x: number;
  width: number;
  height: number;
  kind: SkyRunObstacleKind;
  objectType: SkyRunObjectType;
  surfaceY: number;
  worldIndex: number;
}

export interface SkyRunCoin {
  id: number;
  x: number;
  y: number;
}

export interface SkyRunSnapshot {
  phase: SkyRunPhase;
  jumpHeight: number;
  playerVelocityY: number;
  isGrounded: boolean;
  score: number;
  bestScore: number;
  distance: number;
  speedMultiplier: number;
  worldIndex: number;
  transitionFromWorldIndex: number | null;
  worldTransitionProgress: number;
  obstacles: SkyRunObstacle[];
  coins: SkyRunCoin[];
  coinsCollected: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export interface SkyRunJumpClearanceWindow {
  firstSafeSecond: number;
  lastSafeSecond: number;
}

/** Shared one-step jump integration used by gameplay and bot prediction. */
export function stepSkyRunJump(jumpHeight: number, velocityY: number, dt: number) {
  const nextVelocityY = Math.max(-C.maxFallSpeed, velocityY - C.gravity * dt);
  const nextHeight = Math.max(0, jumpHeight + nextVelocityY * dt);
  const isGrounded = nextHeight === 0;
  return {
    jumpHeight: nextHeight,
    playerVelocityY: isGrounded ? 0 : nextVelocityY,
    isGrounded,
  };
}

/** Predict the safe part of the real jump arc using the same integration as gameplay. */
export function getSkyRunJumpClearanceWindow(
  requiredHeight: number,
  predictionStepSeconds = 1 / 120,
): SkyRunJumpClearanceWindow | null {
  if (!Number.isFinite(requiredHeight) || requiredHeight < 0) return null;
  const step = clamp(predictionStepSeconds, 1 / 240, 0.05);
  let height = 0;
  let velocityY: number = C.jumpImpulse;
  let firstSafeSecond: number | null = null;
  let lastSafeSecond = 0;

  for (let index = 1; index <= 240; index++) {
    const next = stepSkyRunJump(height, velocityY, step);
    height = next.jumpHeight;
    velocityY = next.playerVelocityY;
    const elapsed = index * step;
    if (height >= requiredHeight) {
      firstSafeSecond ??= elapsed;
      lastSafeSecond = elapsed;
    }
    if (next.isGrounded) break;
  }

  if (firstSafeSecond === null || lastSafeSecond <= firstSafeSecond) return null;
  return { firstSafeSecond, lastSafeSecond };
}

/** Continuous pace curve: +3% per 1,000 points, capped at 1.18×. */
export function getSkyRunSpeedMultiplier(score: number) {
  const points = Number.isFinite(score) ? Math.max(0, score) : 0;
  return Math.min(C.maxSpeedMultiplier, 1 + points * C.speedMultiplierIncreasePerPoint);
}

/** Solo pace grows smoothly by 3% per complete six-world cycle, within the shared speed cap. */
export function getSkyRunSingleplayerSpeedMultiplier(distance: number) {
  const safeDistance = Number.isFinite(distance) ? Math.max(0, distance) : 0;
  const completedCycleProgress = safeDistance / SKY_RUN_TOTAL_DISTANCE;
  return Math.min(
    C.maxSpeedMultiplier,
    1 + completedCycleProgress * C.speedMultiplierIncreasePerCycle,
  );
}

export interface SkyRunEngineOptions {
  /** Wrap the six-world sequence for infinite Singleplayer; Multiplayer stays finite by default. */
  loopWorlds?: boolean;
}

export class SkyRunEngine {
  readonly playerX: number;
  private readonly loopWorlds: boolean;
  phase: SkyRunPhase = "ready";
  jumpHeight = 0;
  playerVelocityY = 0;
  isGrounded = true;
  score = 0;
  bestScore = 0;
  distance = 0;
  obstacles: SkyRunObstacle[] = [];
  coins: SkyRunCoin[] = [];
  coinsCollected = 0;
  worldIndex = 0;
  transitionFromWorldIndex: number | null = null;
  worldTransitionProgress = 1;

  private nextObstacleId = 1;
  private nextCoinId = 1;
  private randomState = 1;
  private worldTransitionElapsedSeconds = 0;

  constructor(seed?: number, playerX: number = C.playerX, options: SkyRunEngineOptions = {}) {
    this.playerX = playerX;
    this.loopWorlds = options.loopWorlds ?? false;
    this.reset(seed);
  }

  setBestScore(score: number) {
    this.bestScore = Math.max(this.bestScore, Math.floor(score) || 0);
  }

  /** Reset this mode without remounting the app or discarding its saved record. */
  reset(seed?: number) {
    this.phase = "ready";
    this.jumpHeight = 0;
    this.playerVelocityY = 0;
    this.isGrounded = true;
    this.score = 0;
    this.distance = 0;
    this.obstacles = [];
    this.coins = [];
    this.coinsCollected = 0;
    this.worldIndex = 0;
    this.transitionFromWorldIndex = null;
    this.worldTransitionProgress = 1;
    this.worldTransitionElapsedSeconds = 0;
    this.nextObstacleId = 1;
    this.nextCoinId = 1;
    this.randomState = (seed ?? (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 1;
  }

  /** First press starts the run; later presses jump only while grounded. */
  pressJump(): SkyRunInputResult {
    if (this.phase === "gameover") return "ignored";
    if (this.phase === "ready") {
      this.phase = "playing";
      return "started";
    }
    if (!this.isGrounded) return "ignored";

    this.isGrounded = false;
    this.playerVelocityY = C.jumpImpulse;
    return "jumped";
  }

  step(deltaSeconds: number) {
    if (this.phase !== "playing") return;
    const dt = clamp(deltaSeconds, 0, 0.05);
    if (dt === 0) return;

    const speed = C.baseRunSpeed * this.currentSpeedMultiplier();
    this.distance += speed * dt;
    this.score = Math.floor(this.distance / C.distancePerPoint);
    this.bestScore = Math.max(this.bestScore, this.score);

    const absoluteWorldIndex = Math.floor(this.distance / C.worldSegmentDistance);
    const nextWorldIndex = this.loopWorlds
      ? absoluteWorldIndex % SKY_RUN_WORLD_NAMES.length
      : Math.min(SKY_RUN_WORLD_NAMES.length - 1, absoluteWorldIndex);
    if (nextWorldIndex !== this.worldIndex) {
      this.transitionFromWorldIndex = this.worldIndex;
      this.worldIndex = nextWorldIndex;
      this.worldTransitionElapsedSeconds = 0;
      this.worldTransitionProgress = 0;
    }
    if (this.transitionFromWorldIndex !== null) {
      this.worldTransitionElapsedSeconds = Math.min(
        C.worldTransitionDurationSeconds,
        this.worldTransitionElapsedSeconds + dt,
      );
      this.worldTransitionProgress =
        this.worldTransitionElapsedSeconds / C.worldTransitionDurationSeconds;
      if (this.worldTransitionProgress >= 1) {
        this.transitionFromWorldIndex = null;
        this.worldTransitionProgress = 1;
      }
    }

    if (!this.isGrounded) {
      const jump = stepSkyRunJump(this.jumpHeight, this.playerVelocityY, dt);
      this.jumpHeight = jump.jumpHeight;
      this.playerVelocityY = jump.playerVelocityY;
      this.isGrounded = jump.isGrounded;
    }

    for (const obstacle of this.obstacles) obstacle.x -= speed * dt;
    for (const coin of this.coins) coin.x -= speed * dt;

    const playerLeft = this.playerX - C.playerHitWidth / 2;
    const playerRight = this.playerX + C.playerHitWidth / 2;
    const playerCenterY = C.groundY - this.jumpHeight - C.playerSpriteHeight / 2;
    this.coins = this.coins.filter((coin) => {
      const overlapsPlayer =
        coin.x + 11 >= playerLeft &&
        coin.x - 11 <= playerRight &&
        Math.abs(coin.y - playerCenterY) <= C.playerSpriteHeight * 0.36 + 11;
      if (overlapsPlayer) this.coinsCollected += 1;
      return !overlapsPlayer && coin.x >= -11;
    });

    for (const obstacle of this.obstacles) {
      if (obstacle.objectType !== "GROUND_OBSTACLE") continue;
      const overlapsHorizontally =
        playerRight > obstacle.x && playerLeft < obstacle.x + obstacle.width;
      const playerFeetY = C.groundY - this.jumpHeight;
      const obstacleTopY = obstacle.surfaceY - obstacle.height;
      if (overlapsHorizontally && playerFeetY > obstacleTopY && playerFeetY <= obstacle.surfaceY) {
        this.phase = "gameover";
        return;
      }
    }

    this.obstacles = this.obstacles.filter((obstacle) => obstacle.x + obstacle.width >= 0);
    this.ensureObstaclesAhead();
  }

  snapshot(): SkyRunSnapshot {
    return {
      phase: this.phase,
      jumpHeight: this.jumpHeight,
      playerVelocityY: this.playerVelocityY,
      isGrounded: this.isGrounded,
      score: this.score,
      bestScore: this.bestScore,
      distance: this.distance,
      speedMultiplier: this.currentSpeedMultiplier(),
      worldIndex: this.worldIndex,
      transitionFromWorldIndex: this.transitionFromWorldIndex,
      worldTransitionProgress: this.worldTransitionProgress,
      obstacles: this.obstacles.map((obstacle) => ({ ...obstacle })),
      coins: this.coins.map((coin) => ({ ...coin })),
      coinsCollected: this.coinsCollected,
    };
  }

  private currentSpeedMultiplier() {
    return this.loopWorlds
      ? getSkyRunSingleplayerSpeedMultiplier(this.distance)
      : getSkyRunSpeedMultiplier(this.distance / C.distancePerPoint);
  }

  private makeObstacle(x: number): SkyRunObstacle {
    const roll = this.random();
    const candyKinds: readonly SkyRunObstacleKind[] = [
      "lollipop",
      "chocolate-bar",
      "cookie-block",
      "sugar-crystal",
      "marshmallow-stack",
      "cupcake",
    ];
    const kind: SkyRunObstacleKind =
      this.worldIndex === 5
        ? (candyKinds[Math.floor(roll * candyKinds.length)] ?? "cookie-block")
        : roll < 0.38
          ? "crystal"
          : roll < 0.72
            ? "rune-pillar"
            : "cloud-stone";
    const heights =
      this.worldIndex === 5 ? ([32, 38, 44, 48] as const) : ([24, 32, 40, 48] as const);
    const height = heights[Math.floor(this.random() * heights.length)] ?? 24;
    const width =
      kind === "crystal" || kind === "sugar-crystal"
        ? 30 + Math.round(this.random() * 8)
        : kind === "chocolate-bar" || kind === "cupcake"
          ? 42 + Math.round(this.random() * 10)
          : 34 + Math.round(this.random() * 8);
    return {
      id: this.nextObstacleId++,
      x,
      width,
      height,
      kind,
      objectType: "GROUND_OBSTACLE",
      surfaceY: C.groundY,
      worldIndex: this.worldIndex,
    };
  }

  private ensureObstaclesAhead() {
    let last = this.obstacles.at(-1);
    if (!last && this.obstacles.length < C.maxObstacles) {
      last = this.makeObstacle(C.firstObstacleX);
      this.obstacles.push(last);
    }

    while (last && last.x < C.width + C.spawnAhead && this.obstacles.length < C.maxObstacles) {
      const gap =
        C.minObstacleSpacing + this.random() * (C.maxObstacleSpacing - C.minObstacleSpacing);
      const previous = last;
      const next = this.makeObstacle(previous.x + gap);
      const freeGap = next.x - (previous.x + previous.width);
      if (freeGap > 24) {
        this.coins.push({
          id: this.nextCoinId++,
          x: previous.x + previous.width + freeGap / 2,
          y: C.groundY - C.playerSpriteHeight / 2,
        });
      }
      last = next;
      this.obstacles.push(next);
    }
  }

  private random() {
    this.randomState = (1664525 * this.randomState + 1013904223) >>> 0;
    return this.randomState / 0x100000000;
  }
}
