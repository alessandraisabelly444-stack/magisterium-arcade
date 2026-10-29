import { SKY_FLAP_CONFIG as C } from "./config";

export type SkyFlapPhase = "ready" | "playing" | "gameover";
export type SkyFlapParticipantPhase = "ready" | "playing" | "eliminated";

export interface SkyFlapObstacle {
  id: number;
  x: number;
  gapCenter: number;
  scored: boolean;
  scoredByPlayerIds?: string[];
}

interface MutableSkyFlapObstacle {
  id: number;
  x: number;
  gapCenter: number;
  scoredByPlayerIds: string[];
}

export interface SkyFlapCorePlayerState {
  id: string;
  playerX: number;
  playerY: number;
  playerVelocityY: number;
  score: number;
  bestScore: number;
  phase: SkyFlapParticipantPhase;
}

export interface SkyFlapCoreStepResult {
  scoredPlayerIds: string[];
  eliminatedPlayerIds: string[];
  speedMultiplier: number;
}

export interface SkyFlapSnapshot {
  phase: SkyFlapPhase;
  playerX: number;
  playerY: number;
  playerVelocityY: number;
  score: number;
  speedMultiplier: number;
  bestScore: number;
  scrollDistance: number;
  obstacles: SkyFlapObstacle[];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getSkyFlapCoinReward(score: number) {
  const safeScore = Number.isFinite(score) ? Math.floor(score) : 0;
  return Math.floor(Math.max(0, safeScore) / 10);
}

export function getScrollSpeedMultiplier(score: number) {
  const safeScore = Number.isFinite(score) ? score : 0;
  const earnedPoints = Math.max(0, Math.floor(safeScore) - 4);
  return Math.min(C.maxSpeedMultiplier, 1 + earnedPoints * C.speedGainPerPoint);
}

export function createSkyFlapPlayerState(
  id: string,
  playerY = C.height / 2,
  playerX = C.playerX,
): SkyFlapCorePlayerState {
  return {
    id,
    playerX,
    playerY,
    playerVelocityY: 0,
    score: 0,
    bestScore: 0,
    phase: "ready",
  };
}

/** Shared world, obstacle, scoring, speed and per-player collision/physics core. */
export class SkyFlapCore {
  scrollDistance = 0;

  private obstacles: MutableSkyFlapObstacle[] = [];
  private nextObstacleId = 1;
  private randomState = 1;

  constructor(seed?: number) {
    this.reset(seed);
  }

  reset(seed?: number) {
    this.scrollDistance = 0;
    this.nextObstacleId = 1;
    this.randomState = (seed ?? (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 1;

    const firstGap = C.height / 2;
    const secondGap = this.nextGapCenter(firstGap);
    this.obstacles = [
      this.makeObstacle(C.firstObstacleX, firstGap),
      this.makeObstacle(C.firstObstacleX + C.obstacleSpacing, secondGap),
    ];
  }

  startPlayers(players: SkyFlapCorePlayerState[]) {
    for (const player of players) {
      if (player.phase === "ready") player.phase = "playing";
    }
  }

  flap(player: SkyFlapCorePlayerState) {
    if (player.phase === "eliminated") return false;
    player.phase = "playing";
    player.playerVelocityY = C.flapImpulse;
    return true;
  }

  step(deltaSeconds: number, players: SkyFlapCorePlayerState[]): SkyFlapCoreStepResult {
    const activePlayers = players.filter((player) => player.phase === "playing");
    const progressScore = Math.max(0, ...players.map((player) => player.score));
    const speedMultiplier = getScrollSpeedMultiplier(progressScore);
    const result: SkyFlapCoreStepResult = {
      scoredPlayerIds: [],
      eliminatedPlayerIds: [],
      speedMultiplier,
    };
    const dt = clamp(deltaSeconds, 0, 0.05);
    if (dt === 0 || activePlayers.length === 0) return result;

    const obstacleSpeed = C.obstacleSpeed * speedMultiplier;
    this.scrollDistance += obstacleSpeed * dt;
    for (const obstacle of this.obstacles) obstacle.x -= obstacleSpeed * dt;

    for (const player of activePlayers) {
      player.playerVelocityY = Math.min(C.maxFallSpeed, player.playerVelocityY + C.gravity * dt);
      player.playerY += player.playerVelocityY * dt;

      if (
        player.playerY - C.playerHitHeight / 2 <= 0 ||
        player.playerY + C.playerHitHeight / 2 >= C.height
      ) {
        player.phase = "eliminated";
        result.eliminatedPlayerIds.push(player.id);
        continue;
      }

      const playerLeft = player.playerX - C.playerHitWidth / 2;
      const playerRight = player.playerX + C.playerHitWidth / 2;

      for (const obstacle of this.obstacles) {
        const obstacleRight = obstacle.x + C.obstacleWidth;
        const overlapsHorizontally = playerRight > obstacle.x && playerLeft < obstacleRight;
        if (overlapsHorizontally) {
          const gapTop = obstacle.gapCenter - C.gapHeight / 2;
          const gapBottom = obstacle.gapCenter + C.gapHeight / 2;
          const playerTop = player.playerY - C.playerHitHeight / 2;
          const playerBottom = player.playerY + C.playerHitHeight / 2;
          if (playerTop < gapTop || playerBottom > gapBottom) {
            player.phase = "eliminated";
            result.eliminatedPlayerIds.push(player.id);
            break;
          }
        }

        if (!obstacle.scoredByPlayerIds.includes(player.id) && obstacleRight < playerLeft) {
          obstacle.scoredByPlayerIds.push(player.id);
          player.score += 1;
          player.bestScore = Math.max(player.bestScore, player.score);
          result.scoredPlayerIds.push(player.id);
        }
      }
    }

    if (!players.some((player) => player.phase === "playing")) {
      result.speedMultiplier = getScrollSpeedMultiplier(
        Math.max(0, ...players.map((player) => player.score)),
      );
      return result;
    }

    this.obstacles = this.obstacles.filter((obstacle) => obstacle.x + C.obstacleWidth >= 0);
    this.ensureObstacleAhead();
    result.speedMultiplier = getScrollSpeedMultiplier(
      Math.max(0, ...players.map((player) => player.score)),
    );
    return result;
  }

  snapshotObstacles(playerId?: string): SkyFlapObstacle[] {
    return this.obstacles.map((obstacle) => ({
      id: obstacle.id,
      x: obstacle.x,
      gapCenter: obstacle.gapCenter,
      scored: playerId
        ? obstacle.scoredByPlayerIds.includes(playerId)
        : obstacle.scoredByPlayerIds.length > 0,
      scoredByPlayerIds: [...obstacle.scoredByPlayerIds],
    }));
  }

  private makeObstacle(x: number, gapCenter: number): MutableSkyFlapObstacle {
    return { id: this.nextObstacleId++, x, gapCenter, scoredByPlayerIds: [] };
  }

  private ensureObstacleAhead() {
    let last = this.obstacles.at(-1);
    if (!last) {
      last = this.makeObstacle(C.width + 100, C.height / 2);
      this.obstacles.push(last);
    }

    while (last && last.x < C.width + C.spawnAhead) {
      const gapCenter = this.nextGapCenter(last.gapCenter);
      last = this.makeObstacle(last.x + C.obstacleSpacing, gapCenter);
      this.obstacles.push(last);
    }
  }

  private nextGapCenter(previous: number) {
    this.randomState = (1664525 * this.randomState + 1013904223) >>> 0;
    const random = this.randomState / 0x100000000;
    const min = C.gapHeight / 2 + C.playerHitHeight / 2 + C.safeGapMargin;
    const max = C.height - min;
    const offset = (random * 2 - 1) * C.maxGapShift;
    return clamp(previous + offset, min, max);
  }
}

/** Solo adapter kept API-compatible with the original one-player screen. */
export class SkyFlapEngine {
  readonly core: SkyFlapCore;
  private player: SkyFlapCorePlayerState;

  constructor(seed?: number) {
    this.core = new SkyFlapCore(seed);
    this.player = createSkyFlapPlayerState("solo");
  }

  get phase(): SkyFlapPhase {
    return this.player.phase === "eliminated" ? "gameover" : this.player.phase;
  }

  get playerY() {
    return this.player.playerY;
  }

  get playerVelocityY() {
    return this.player.playerVelocityY;
  }

  get score() {
    return this.player.score;
  }

  get bestScore() {
    return this.player.bestScore;
  }

  get scrollDistance() {
    return this.core.scrollDistance;
  }

  get obstacles() {
    return this.core.snapshotObstacles("solo");
  }

  setBestScore(score: number) {
    this.player.bestScore = Math.max(this.player.bestScore, Math.floor(score) || 0);
  }

  reset(seed?: number) {
    const bestScore = this.player.bestScore;
    this.core.reset(seed);
    this.player = createSkyFlapPlayerState("solo");
    this.player.bestScore = bestScore;
  }

  flap() {
    return this.core.flap(this.player);
  }

  step(deltaSeconds: number) {
    this.core.step(deltaSeconds, [this.player]);
  }

  snapshot(): SkyFlapSnapshot {
    return {
      phase: this.phase,
      playerX: this.player.playerX,
      playerY: this.player.playerY,
      playerVelocityY: this.player.playerVelocityY,
      score: this.player.score,
      speedMultiplier: getScrollSpeedMultiplier(this.player.score),
      bestScore: this.player.bestScore,
      scrollDistance: this.core.scrollDistance,
      obstacles: this.core.snapshotObstacles("solo"),
    };
  }
}
