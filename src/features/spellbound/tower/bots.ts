import type { PlayableCharacterId } from "../types";
import { TOWER_CONFIG as C } from "./config";
import type { TowerEngine } from "./engine";

export type BotDifficulty = "easy" | "medium" | "hard";

export const BOT_LABELS: Record<BotDifficulty, string> = {
  easy: "FÁCIL",
  medium: "MÉDIO",
  hard: "DIFÍCIL",
};

interface BotProfile {
  thinkTime: number;
  moveInterval: number;
  dropSpeed: number;
}

const PROFILES: Record<BotDifficulty, BotProfile> = {
  easy: { thinkTime: 0.35, moveInterval: 0.09, dropSpeed: 170 },
  medium: { thinkTime: 0.5, moveInterval: 0.08, dropSpeed: 150 },
  hard: { thinkTime: 0.6, moveInterval: 0.07, dropSpeed: 140 },
};

interface Plan {
  rot: number;
  x: number;
}

interface RankedPlan extends Plan {
  score: number;
}

const CENTER = C.width / 2;
const HALF_BASE = C.platformWidth / 2;

/** Candidate x positions snapped to the engine's move step. */
function candidateXs(from: number) {
  const xs: number[] = [];
  for (let dx = -HALF_BASE - C.cell; dx <= HALF_BASE + C.cell; dx += C.moveStep) {
    xs.push(from + Math.round((CENTER + dx - from) / C.moveStep) * C.moveStep);
  }
  return [...new Set(xs)];
}

function choosePlan(engine: TowerEngine, difficulty: BotDifficulty): Plan {
  const body = engine.active!;
  const startX = body.position.x;
  const candidates: RankedPlan[] = [];
  for (let rot = 0; rot < 4; rot++) {
    for (const x of candidateXs(startX)) {
      const landing = engine.probe(rot, x);
      if (!landing) continue;
      const centerX = (landing.minX + landing.maxX) / 2;
      const offCenter = Math.abs(centerX - CENTER);
      const overhang =
        Math.max(0, CENTER - HALF_BASE - landing.minX) +
        Math.max(0, landing.maxX - (CENTER + HALF_BASE));
      const heightGain = Math.max(0, C.platformTop - landing.landY);
      const score =
        landing.support * (difficulty === "hard" ? 24 : 19) +
        landing.supportBalance * (difficulty === "hard" ? 52 : 38) +
        landing.supportSpan * (difficulty === "hard" ? 0.2 : 0.16) +
        heightGain * (difficulty === "hard" ? 0.18 : 0.12) -
        offCenter * (difficulty === "hard" ? 0.16 : 0.24) -
        overhang * (difficulty === "hard" ? 7 : 5);
      candidates.push({ rot, x, score });
    }
  }

  if (candidates.length === 0) return { rot: 0, x: startX };

  // Keep the beginner opponent intentionally imperfect, but never ask it to place an invalid move.
  if (difficulty === "easy") {
    return candidates[Math.floor(Math.random() * candidates.length)]!;
  }

  candidates.sort((a, b) => b.score - a.score);
  const lookAheadCount = difficulty === "hard" ? 6 : 4;
  const futureWeight = difficulty === "hard" ? 0.42 : 0.24;
  for (const candidate of candidates.slice(0, lookAheadCount)) {
    candidate.score +=
      engine.futurePlacementQuality(candidate.rot, candidate.x, engine.nextType) * futureWeight;
  }
  candidates.sort((a, b) => b.score - a.score);

  const bestScore = candidates[0]!.score;
  const tieWindow = difficulty === "medium" ? 8 : 0.05;
  const nearBest = candidates.filter((candidate) => bestScore - candidate.score <= tieWindow);
  return difficulty === "medium"
    ? nearBest[Math.floor(Math.random() * nearBest.length)]!
    : candidates[0]!;
}

/** Drives a TowerEngine exactly like a player would: rotate, move, drop. */
export class TowerBot {
  private profile: BotProfile;
  private piece: unknown = null;
  private plan: Plan | null = null;
  private rotationsLeft = 0;
  private timer = 0;

  constructor(
    public engine: TowerEngine,
    public difficulty: BotDifficulty,
  ) {
    this.profile = PROFILES[difficulty];
    engine.dropSpeed = this.profile.dropSpeed;
  }

  update(dt: number) {
    const e = this.engine;
    if (e.status !== "playing" || !e.active) {
      this.piece = null;
      return;
    }
    if (e.active !== this.piece) {
      this.piece = e.active;
      this.plan = null;
      this.timer = this.profile.thinkTime * (0.7 + Math.random() * 0.6);
      e.softDrop = false;
    }
    this.timer -= dt;
    if (this.timer > 0) return;

    if (!this.plan) {
      this.plan = choosePlan(e, this.difficulty);
      this.rotationsLeft = this.plan.rot;
      this.timer = this.profile.moveInterval;
      return;
    }
    this.timer = this.profile.moveInterval;
    if (this.rotationsLeft > 0) {
      const rotated = e.rotate();
      this.rotationsLeft--;
      if (!rotated) {
        // Rotation was blocked by the current stack; keep a legal orientation and replan.
        this.plan = { rot: 0, x: e.active.position.x };
        this.rotationsLeft = 0;
      }
      return;
    }
    const dx = this.plan.x - e.active.position.x;
    if (Math.abs(dx) >= C.moveStep / 2) {
      if (!e.move(dx > 0 ? 1 : -1)) {
        // Pieces beneath can move while a plan is running; recalculate rather than commit to a bad spot.
        this.plan = null;
        this.rotationsLeft = 0;
        this.timer = 0;
        e.softDrop = false;
      }
      return;
    }
    if (this.difficulty !== "hard") e.softDrop = true;
  }
}

const BOT_SEATS: BotDifficulty[] = ["easy", "medium", "hard"];
const DEFAULT_BOT_CHARACTERS: PlayableCharacterId[] = [
  "white-fox-ice-mage",
  "purple-rabbit-ninja",
  "swamp-frog-mage",
  "forge-raccoon-mage",
  "time-owl-mage",
];

/** Fox, Rabbit, Frog by default — swapping out whichever one the player picked. */
export function pickBotLineup(playerId: PlayableCharacterId | null) {
  const pool = DEFAULT_BOT_CHARACTERS.filter((id) => id !== playerId);
  return BOT_SEATS.map((difficulty, i) => ({ difficulty, characterId: pool[i]! }));
}
