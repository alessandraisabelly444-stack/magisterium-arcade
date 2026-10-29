import { SKY_FLAP_CONFIG as C } from "./config";
import type { SkyFlapCore, SkyFlapCorePlayerState, SkyFlapObstacle } from "./engine";

export type SkyFlapBotDifficulty = "casual" | "balanced" | "skilled";

const BOT_PROFILES: Record<
  SkyFlapBotDifficulty,
  { liftThreshold: number; decisionInterval: number; mistakeChance: number }
> = {
  casual: { liftThreshold: 34, decisionInterval: 0.16, mistakeChance: 0.14 },
  balanced: { liftThreshold: 27, decisionInterval: 0.12, mistakeChance: 0.07 },
  skilled: { liftThreshold: 21, decisionInterval: 0.1, mistakeChance: 0.025 },
};

/** Sky Flap-specific controller: gently regulates altitude toward the next portal's opening. */
export class SkyFlapBot {
  private readonly profile: (typeof BOT_PROFILES)[SkyFlapBotDifficulty];
  private nextDecisionIn = 0;
  private randomState: number;

  constructor(
    public readonly difficulty: SkyFlapBotDifficulty,
    seed: number,
  ) {
    this.profile = BOT_PROFILES[difficulty];
    this.randomState = seed >>> 0 || 1;
  }

  update(
    core: SkyFlapCore,
    player: SkyFlapCorePlayerState,
    obstacles: readonly SkyFlapObstacle[],
    speedMultiplier: number,
    deltaSeconds: number,
  ) {
    if (player.phase !== "playing") return;
    this.nextDecisionIn -= deltaSeconds;
    if (this.nextDecisionIn > 0) return;
    this.nextDecisionIn = this.profile.decisionInterval;

    const next = obstacles.find(
      (obstacle) => obstacle.x + C.obstacleWidth >= player.playerX - C.playerHitWidth / 2,
    );
    if (!next) return;

    const distance = next.x - (player.playerX + C.playerHitWidth / 2);
    if (distance < -C.obstacleWidth) return;

    // Tighten the correction window slightly as the shared scrolling speed rises.
    const liftThreshold = this.profile.liftThreshold - Math.min(8, (speedMultiplier - 1) * 20);
    const needsLift =
      player.playerY > next.gapCenter + liftThreshold && player.playerVelocityY > -65;
    if (!needsLift || this.random() < this.profile.mistakeChance) return;
    core.flap(player);
  }

  private random() {
    this.randomState = (1664525 * this.randomState + 1013904223) >>> 0;
    return this.randomState / 0x100000000;
  }
}
