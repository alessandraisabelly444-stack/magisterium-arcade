import type { PlayableCharacterId } from "../types";
import { SKY_FLAP_CONFIG as C } from "./config";
import { SkyFlapBot, type SkyFlapBotDifficulty } from "./bots";
import {
  createSkyFlapPlayerState,
  getScrollSpeedMultiplier,
  SkyFlapCore,
  type SkyFlapCorePlayerState,
  type SkyFlapCoreStepResult,
  type SkyFlapObstacle,
} from "./engine";

export const MIN_SKY_FLAP_PLAYERS = 2;
export const MAX_SKY_FLAP_PLAYERS = 4;
export const SKY_FLAP_PLAYER_CONTROLS = ["SPACE / CLIQUE", "ENTER", "W", "↑"] as const;
export const SKY_FLAP_VOTE_SECONDS = 10;

const RESULTS_DISPLAY_SECONDS = 2.4;
const DECISION_DISPLAY_SECONDS = 2.2;

export type SkyFlapMatchPhase =
  "countdown" | "playing" | "results" | "voting" | "decision" | "rematch" | "change-game";
export type SkyFlapPostMatchVote = "rematch" | "change-game";

export interface SkyFlapParticipantConfig {
  id: string;
  name: string;
  characterId: PlayableCharacterId;
  isBot?: boolean;
  botDifficulty?: SkyFlapBotDifficulty;
}

export interface SkyFlapMatchPlayer extends SkyFlapCorePlayerState {
  name: string;
  characterId: PlayableCharacterId;
  isBot: boolean;
  eliminationOrder: number | null;
}

export interface SkyFlapMultiplayerSnapshot {
  phase: SkyFlapMatchPhase;
  countdownLabel: string | null;
  scrollDistance: number;
  speedMultiplier: number;
  winnerId: string | null;
  players: SkyFlapMatchPlayer[];
  ranking: SkyFlapMatchPlayer[];
  obstacles: SkyFlapObstacle[];
  votingSecondsRemaining: number;
  decisionSecondsRemaining: number;
  voteCounts: Record<SkyFlapPostMatchVote, number>;
  votesByPlayer: Record<string, SkyFlapPostMatchVote | null>;
  humanVoterCount: number;
  voteDecision: SkyFlapPostMatchVote | null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function emptyStepResult(speedMultiplier: number): SkyFlapCoreStepResult {
  return { scoredPlayerIds: [], eliminatedPlayerIds: [], speedMultiplier };
}

/** One shared course/speed curve; each participant owns independent physics and elimination state. */
export class SkyFlapMultiplayerEngine {
  readonly core: SkyFlapCore;
  readonly players: SkyFlapMatchPlayer[];
  phase: SkyFlapMatchPhase = "countdown";
  winnerId: string | null = null;
  voteDecision: SkyFlapPostMatchVote | null = null;

  private countdownElapsed = 0;
  private goLabelRemaining = 0;
  private nextEliminationOrder = 1;
  private phaseElapsedSeconds = 0;
  private readonly botControllers: Map<string, SkyFlapBot>;
  private readonly votes = new Map<string, SkyFlapPostMatchVote>();

  constructor(participants: SkyFlapParticipantConfig[], seed?: number) {
    if (participants.length < MIN_SKY_FLAP_PLAYERS || participants.length > MAX_SKY_FLAP_PLAYERS) {
      throw new RangeError(
        `Sky Flap Multiplayer aceita de ${MIN_SKY_FLAP_PLAYERS} a ${MAX_SKY_FLAP_PLAYERS} participantes.`,
      );
    }

    this.core = new SkyFlapCore(seed);
    const verticalSpacing = 40;
    this.players = participants.map((participant, index) => {
      const player = createSkyFlapPlayerState(
        participant.id,
        C.height / 2 + (index - (participants.length - 1) / 2) * verticalSpacing,
      );
      return {
        ...player,
        name: participant.name.trim() || `JOGADOR ${index + 1}`,
        characterId: participant.characterId,
        isBot: participant.isBot ?? false,
        eliminationOrder: null,
      };
    });
    const botSeedBase = seed ?? Date.now() ^ 0x51f15e;
    this.botControllers = new Map(
      participants.flatMap((participant, index) =>
        participant.isBot
          ? [
              [
                participant.id,
                new SkyFlapBot(
                  participant.botDifficulty ?? "balanced",
                  botSeedBase + (index + 1) * 0x9e3779b9,
                ),
              ] as const,
            ]
          : [],
      ),
    );
  }

  get speedMultiplier() {
    return getScrollSpeedMultiplier(Math.max(0, ...this.players.map((player) => player.score)));
  }

  get countdownLabel() {
    if (this.phase === "countdown") {
      return String(Math.max(1, 3 - Math.floor(this.countdownElapsed)));
    }
    return this.phase === "playing" && this.goLabelRemaining > 0 ? "VAI!" : null;
  }

  get humanVoterCount() {
    return this.players.filter((player) => !player.isBot).length;
  }

  vote(playerId: string, choice: SkyFlapPostMatchVote) {
    if (this.phase !== "voting") return false;
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (!player || player.isBot) return false;
    this.votes.set(playerId, choice);
    if (this.votes.size >= this.humanVoterCount) this.resolveVote();
    return true;
  }

  flap(playerId: string) {
    if (this.phase !== "playing") return false;
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (!player || player.isBot || player.phase !== "playing") return false;
    return this.core.flap(player);
  }

  step(deltaSeconds: number): SkyFlapCoreStepResult {
    const dt = clamp(deltaSeconds, 0, 0.05);
    if (dt === 0) return emptyStepResult(this.speedMultiplier);

    if (this.phase === "countdown") {
      this.countdownElapsed += dt;
      if (this.countdownElapsed >= 3) {
        this.phase = "playing";
        this.core.startPlayers(this.players);
        this.goLabelRemaining = 0.55;
      }
      return emptyStepResult(this.speedMultiplier);
    }

    if (this.phase === "results") {
      this.phaseElapsedSeconds += dt;
      if (this.phaseElapsedSeconds >= RESULTS_DISPLAY_SECONDS) {
        this.phase = "voting";
        this.phaseElapsedSeconds = 0;
      }
      return emptyStepResult(this.speedMultiplier);
    }

    if (this.phase === "voting") {
      this.phaseElapsedSeconds += dt;
      if (this.phaseElapsedSeconds >= SKY_FLAP_VOTE_SECONDS) this.resolveVote();
      return emptyStepResult(this.speedMultiplier);
    }

    if (this.phase === "decision") {
      this.phaseElapsedSeconds += dt;
      if (this.phaseElapsedSeconds >= DECISION_DISPLAY_SECONDS) {
        this.phase = this.voteDecision === "change-game" ? "change-game" : "rematch";
      }
      return emptyStepResult(this.speedMultiplier);
    }

    if (this.phase !== "playing") return emptyStepResult(this.speedMultiplier);

    this.goLabelRemaining = Math.max(0, this.goLabelRemaining - dt);
    const obstacles = this.core.snapshotObstacles();
    const speedMultiplier = this.speedMultiplier;
    for (const player of this.players) {
      if (!player.isBot || player.phase !== "playing") continue;
      this.botControllers.get(player.id)?.update(this.core, player, obstacles, speedMultiplier, dt);
    }
    const result = this.core.step(dt, this.players);
    for (const playerId of result.eliminatedPlayerIds) {
      const player = this.players.find((candidate) => candidate.id === playerId);
      if (player) player.eliminationOrder = this.nextEliminationOrder++;
    }

    const remainingPlayers = this.players.filter((player) => player.phase === "playing");
    if (remainingPlayers.length <= 1) {
      this.phase = "results";
      this.phaseElapsedSeconds = 0;
      this.winnerId = remainingPlayers[0]?.id ?? null;
    }

    result.speedMultiplier = this.speedMultiplier;
    return result;
  }

  snapshot(): SkyFlapMultiplayerSnapshot {
    const clone = (player: SkyFlapMatchPlayer): SkyFlapMatchPlayer => ({ ...player });
    return {
      phase: this.phase,
      countdownLabel: this.countdownLabel,
      scrollDistance: this.core.scrollDistance,
      speedMultiplier: this.speedMultiplier,
      winnerId: this.winnerId,
      players: this.players.map(clone),
      ranking: this.rankedPlayers().map(clone),
      obstacles: this.core.snapshotObstacles(),
      votingSecondsRemaining:
        this.phase === "voting"
          ? Math.max(0, Math.ceil(SKY_FLAP_VOTE_SECONDS - this.phaseElapsedSeconds))
          : 0,
      decisionSecondsRemaining:
        this.phase === "decision"
          ? Math.max(0, DECISION_DISPLAY_SECONDS - this.phaseElapsedSeconds)
          : 0,
      voteCounts: this.voteCounts(),
      votesByPlayer: Object.fromEntries(
        this.players.map((player) => [player.id, this.votes.get(player.id) ?? null]),
      ),
      humanVoterCount: this.humanVoterCount,
      voteDecision: this.voteDecision,
    };
  }

  private resolveVote() {
    if (this.phase !== "voting") return;
    const counts = this.voteCounts();
    const requiredVotes = this.humanVoterCount / 2;
    this.voteDecision = counts["change-game"] > requiredVotes ? "change-game" : "rematch";
    this.phase = "decision";
    this.phaseElapsedSeconds = 0;
  }

  private voteCounts(): Record<SkyFlapPostMatchVote, number> {
    let rematch = 0;
    let changeGame = 0;
    for (const [playerId, choice] of this.votes) {
      const player = this.players.find((candidate) => candidate.id === playerId);
      if (!player || player.isBot) continue;
      if (choice === "rematch") rematch += 1;
      else changeGame += 1;
    }
    return { rematch, "change-game": changeGame };
  }

  private rankedPlayers() {
    return [...this.players].sort((a, b) => {
      if (a.id === this.winnerId) return -1;
      if (b.id === this.winnerId) return 1;
      if (a.score !== b.score) return b.score - a.score;
      return (b.eliminationOrder ?? 0) - (a.eliminationOrder ?? 0);
    });
  }
}
