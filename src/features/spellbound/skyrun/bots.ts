import { SKY_RUN_CONFIG as C } from "./config";
import {
  getSkyRunJumpClearanceWindow,
  getSkyRunSpeedMultiplier,
  type SkyRunEngine,
  type SkyRunObstacle,
} from "./engine";

export type SkyRunBotDifficulty = "casual" | "balanced" | "skilled";

interface SkyRunBotProfile {
  /** Extra world-space clearance; the prediction uses the same jump integrator as the game. */
  clearancePixels: number;
  /** Position within the valid takeoff window: higher means a later, riskier reaction. */
  targetFraction: number;
  /** Additional collision distance in seconds, converted to pixels at the current speed. */
  reactionBufferSeconds: number;
}

const BOT_PROFILES: Record<SkyRunBotDifficulty, SkyRunBotProfile> = {
  casual: {
    clearancePixels: 1,
    targetFraction: 0.58,
    reactionBufferSeconds: 0.025,
  },
  balanced: {
    clearancePixels: 2,
    targetFraction: 0.58,
    reactionBufferSeconds: 0.015,
  },
  skilled: {
    clearancePixels: 4,
    targetFraction: 0.78,
    reactionBufferSeconds: 0.005,
  },
};

/**
 * Sky Run-specific controller. It solves when the grounded jump arc is high enough
 * for the whole horizontal overlap, using the game's real gravity/impulse integration.
 */
export class SkyRunBot {
  private readonly profile: SkyRunBotProfile;
  private targetObstacleId: number | null = null;
  private targetFraction = 0.5;
  constructor(public readonly difficulty: SkyRunBotDifficulty) {
    this.profile = BOT_PROFILES[difficulty];
  }

  update(engine: SkyRunEngine, deltaSeconds: number) {
    if (engine.phase !== "playing") return;

    const playerLeft = engine.playerX - C.playerHitWidth / 2;
    const playerRight = engine.playerX + C.playerHitWidth / 2;
    const obstacle = engine.obstacles
      .filter(
        (candidate) =>
          candidate.objectType === "GROUND_OBSTACLE" && candidate.surfaceY === C.groundY,
      )
      .filter((candidate) => candidate.x + candidate.width >= playerLeft)
      .sort((left, right) => left.x - right.x)[0];

    if (!obstacle) {
      this.clearTarget();
      return;
    }
    if (obstacle.id !== this.targetObstacleId) {
      this.targetObstacleId = obstacle.id;
      this.targetFraction = this.profile.targetFraction;
    }

    const speedMultiplier = getSkyRunSpeedMultiplier(engine.distance / C.distancePerPoint);
    const speed = C.baseRunSpeed * speedMultiplier;
    const distanceToEntry = obstacle.x - playerRight;
    const distanceToExit = obstacle.x + obstacle.width - playerLeft;
    if (distanceToExit < 0) {
      this.clearTarget();
      return;
    }

    const physicsStep = Math.max(0, Math.min(0.05, deltaSeconds));
    if (physicsStep === 0) return;
    // Use continuous time for horizontal overlap; frame-by-frame rounding drifts under jitter.
    const predictionStep = 1 / 120;
    const secondsToEntry = Math.max(0, distanceToEntry / speed);
    const secondsToExit = Math.max(0, distanceToExit / speed);
    const reactionMarginPixels = speed * this.profile.reactionBufferSeconds;
    const reactionLeadSeconds = reactionMarginPixels / speed;
    const clearance = getSkyRunJumpClearanceWindow(
      obstacle.height + this.profile.clearancePixels,
      predictionStep,
    );

    if (!clearance) return;
    const earliestTakeoff = secondsToExit - clearance.lastSafeSecond;
    const latestTakeoff = secondsToEntry - clearance.firstSafeSecond - reactionLeadSeconds;
    const firstAllowedTakeoff = Math.max(0, earliestTakeoff);
    if (latestTakeoff < firstAllowedTakeoff || latestTakeoff < 0) return;

    const safeWindowWidth = latestTakeoff - firstAllowedTakeoff;
    const targetTakeoffIn = firstAllowedTakeoff + safeWindowWidth * this.targetFraction;
    // The current frame can be larger than the one used for the last plan; trigger inside
    // the safe window rather than trying to land on a frame-rounded timestamp.
    if (engine.isGrounded && targetTakeoffIn <= physicsStep + predictionStep / 2) {
      if (engine.pressJump() === "jumped") this.clearTarget();
    }
  }

  private clearTarget() {
    this.targetObstacleId = null;
    this.targetFraction = 0.5;
  }
}
