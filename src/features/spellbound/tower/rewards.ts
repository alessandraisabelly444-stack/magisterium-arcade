import type { TowerStatus } from "./engine";

export const TOWER_REWARD_RULES = {
  coinsPerStablePiece: 5,
  coinsPerPeakMeter: 1,
  victoryBonus: 25,
} as const;

export interface TowerRewardInput {
  status: TowerStatus;
  peakHeightTenths: number;
  stablePieces: number;
}

export interface TowerRewardBreakdown {
  stablePieceBonus: number;
  heightBonus: number;
  victoryBonus: number;
  total: number;
}

function nonNegativeInteger(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/**
 * Calculates Tower rewards from finalized match results only. `stablePieces` is the engine's
 * settled-piece count at match end; active/falling pieces do not earn coins.
 */
export function calculateTowerRewardBreakdown({
  status,
  peakHeightTenths,
  stablePieces,
}: TowerRewardInput): TowerRewardBreakdown {
  if (status === "playing") {
    return { stablePieceBonus: 0, heightBonus: 0, victoryBonus: 0, total: 0 };
  }

  const stablePieceBonus =
    nonNegativeInteger(stablePieces) * TOWER_REWARD_RULES.coinsPerStablePiece;
  const heightBonus =
    Math.floor(nonNegativeInteger(peakHeightTenths) / 10) * TOWER_REWARD_RULES.coinsPerPeakMeter;
  const victoryBonus = status === "won" ? TOWER_REWARD_RULES.victoryBonus : 0;

  return {
    stablePieceBonus,
    heightBonus,
    victoryBonus,
    total: stablePieceBonus + heightBonus + victoryBonus,
  };
}
