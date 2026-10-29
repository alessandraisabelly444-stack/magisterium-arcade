import type { PlayableCharacterId } from "../types";
import { SKY_RUN_CONFIG as C, SKY_RUN_TOTAL_DISTANCE } from "./config";
import { SkyRunBot, type SkyRunBotDifficulty } from "./bots";
import { SkyRunEngine, type SkyRunCoin, type SkyRunPhase, type SkyRunSnapshot } from "./engine";

export const MIN_SKY_RUN_PLAYERS = 2;
export const MAX_SKY_RUN_PLAYERS = 4;
export const SKY_RUN_PLAYER_CONTROLS = ["SPACE / CLIQUE", "ENTER", "W", "↑"] as const;
export const SKY_RUN_VOTE_SECONDS = 10;

export type SkyRunMatchPhase =
  "countdown" | "playing" | "results" | "voting" | "decision" | "rematch" | "change-game";
export type SkyRunParticipantStatus = "racing" | "finished" | "eliminated";
export type SkyRunPostMatchVote = "rematch" | "change-game";

export interface SkyRunParticipantConfig {
  id: string;
  name: string;
  characterId: PlayableCharacterId;
  isBot?: boolean;
  botDifficulty?: SkyRunBotDifficulty;
}

export interface SkyRunMatchPlayer {
  id: string;
  name: string;
  characterId: PlayableCharacterId;
  isBot: boolean;
  phase: SkyRunPhase;
  status: SkyRunParticipantStatus;
  score: number;
  distance: number;
  bestScore: number;
  playerX: number;
  jumpHeight: number;
  playerVelocityY: number;
  isGrounded: boolean;
  coins: SkyRunCoin[];
  coinsCollected: number;
  eliminationOrder: number | null;
  finishOrder: number | null;
  finishTimeSeconds: number | null;
}

export interface SkyRunMultiplayerSnapshot {
  phase: SkyRunMatchPhase;
  countdownLabel: string | null;
  winnerId: string | null;
  world: SkyRunSnapshot;
  players: SkyRunMatchPlayer[];
  ranking: SkyRunMatchPlayer[];
  elapsedSeconds: number;
  votingSecondsRemaining: number;
  decisionSecondsRemaining: number;
  voteCounts: Record<SkyRunPostMatchVote, number>;
  humanVoterCount: number;
  voteDecision: SkyRunPostMatchVote | null;
}

interface RuntimeParticipant {
  id: string;
  name: string;
  characterId: PlayableCharacterId;
  isBot: boolean;
  engine: SkyRunEngine;
  bot: SkyRunBot | null;
  status: SkyRunParticipantStatus;
  eliminationOrder: number | null;
  finishOrder: number | null;
  finishTimeSeconds: number | null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/** Shared deterministic course; participants finish at the final portal or remain eliminated. */
export class SkyRunMultiplayerEngine {
  readonly players: RuntimeParticipant[];
  phase: SkyRunMatchPhase = "countdown";
  winnerId: string | null = null;
  voteDecision: SkyRunPostMatchVote | null = null;

  private countdownElapsed = 0;
  private goLabelRemaining = 0;
  private nextEliminationOrder = 1;
  private nextFinishOrder = 1;
  private readonly seed: number;
  private elapsedSeconds = 0;
  private phaseElapsedSeconds = 0;
  private readonly votes = new Map<string, SkyRunPostMatchVote>();

  constructor(participants: SkyRunParticipantConfig[], seed?: number) {
    if (participants.length < MIN_SKY_RUN_PLAYERS || participants.length > MAX_SKY_RUN_PLAYERS) {
      throw new RangeError(
        `Sky Run Multiplayer aceita de ${MIN_SKY_RUN_PLAYERS} a ${MAX_SKY_RUN_PLAYERS} participantes.`,
      );
    }
    this.seed = (seed ?? (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 1;
    const laneSpacing = 44;
    const firstLaneX = C.playerX - ((participants.length - 1) * laneSpacing) / 2;
    this.players = participants.map((participant, index) => ({
      id: participant.id,
      name: participant.name.trim() || `JOGADOR ${index + 1}`,
      characterId: participant.characterId,
      isBot: participant.isBot ?? false,
      engine: new SkyRunEngine(this.seed, firstLaneX + index * laneSpacing),
      bot: participant.isBot ? new SkyRunBot(participant.botDifficulty ?? "balanced") : null,
      status: "racing",
      eliminationOrder: null,
      finishOrder: null,
      finishTimeSeconds: null,
    }));
  }

  get countdownLabel() {
    if (this.phase === "countdown")
      return String(Math.max(1, 3 - Math.floor(this.countdownElapsed)));
    return this.phase === "playing" && this.goLabelRemaining > 0 ? "VAI!" : null;
  }

  jump(playerId: string) {
    if (this.phase !== "playing") return "ignored" as const;
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (!player || player.isBot || player.status !== "racing") return "ignored" as const;
    return player.engine.pressJump();
  }

  vote(playerId: string, choice: SkyRunPostMatchVote) {
    if (this.phase !== "voting") return false;
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (!player || player.isBot) return false;
    this.votes.set(playerId, choice);
    if (this.votes.size >= this.humanVoterCount) this.resolveVote();
    return true;
  }

  step(deltaSeconds: number) {
    const dt = clamp(deltaSeconds, 0, 0.05);
    if (dt === 0) return;

    if (this.phase === "countdown") {
      this.countdownElapsed += dt;
      if (this.countdownElapsed >= 3) {
        this.phase = "playing";
        for (const player of this.players) player.engine.pressJump();
        this.goLabelRemaining = 0.55;
      }
      return;
    }
    if (this.phase === "playing") {
      this.stepRace(dt);
      return;
    }
    if (this.phase === "results") {
      this.phaseElapsedSeconds += dt;
      if (this.phaseElapsedSeconds >= 2.4) {
        this.phase = "voting";
        this.phaseElapsedSeconds = 0;
      }
      return;
    }
    if (this.phase === "voting") {
      this.phaseElapsedSeconds += dt;
      if (this.phaseElapsedSeconds >= SKY_RUN_VOTE_SECONDS) this.resolveVote();
      return;
    }
    if (this.phase === "decision") {
      this.phaseElapsedSeconds += dt;
      if (this.phaseElapsedSeconds >= 2.2) {
        this.phase = this.voteDecision === "change-game" ? "change-game" : "rematch";
      }
    }
  }

  snapshot(): SkyRunMultiplayerSnapshot {
    const worldPlayer =
      this.players.find((player) => player.status === "racing") ??
      this.players.find((player) => player.finishOrder === 1) ??
      this.players.reduce((furthest, player) =>
        player.engine.distance > furthest.engine.distance ? player : furthest,
      );
    const players = this.players.map((player) => this.toSnapshotPlayer(player));
    return {
      phase: this.phase,
      countdownLabel: this.countdownLabel,
      winnerId: this.winnerId,
      world: worldPlayer.engine.snapshot(),
      players,
      ranking: this.rankedPlayers().map((player) => this.toSnapshotPlayer(player)),
      elapsedSeconds: this.elapsedSeconds,
      votingSecondsRemaining:
        this.phase === "voting"
          ? Math.max(0, Math.ceil(SKY_RUN_VOTE_SECONDS - this.phaseElapsedSeconds))
          : 0,
      decisionSecondsRemaining:
        this.phase === "decision" ? Math.max(0, 2.2 - this.phaseElapsedSeconds) : 0,
      voteCounts: this.voteCounts(),
      humanVoterCount: this.humanVoterCount,
      voteDecision: this.voteDecision,
    };
  }

  private stepRace(dt: number) {
    this.elapsedSeconds += dt;
    this.goLabelRemaining = Math.max(0, this.goLabelRemaining - dt);
    for (const player of this.players) {
      if (player.status !== "racing") continue;
      player.bot?.update(player.engine, dt);
      const wasPlaying = player.engine.phase === "playing";
      player.engine.step(dt);
      if (wasPlaying && player.engine.phase === "gameover") {
        player.status = "eliminated";
        player.eliminationOrder = this.nextEliminationOrder++;
        continue;
      }
      if (player.engine.distance >= SKY_RUN_TOTAL_DISTANCE) {
        player.engine.distance = SKY_RUN_TOTAL_DISTANCE;
        player.engine.score = Math.floor(SKY_RUN_TOTAL_DISTANCE / C.distancePerPoint);
        player.engine.setBestScore(player.engine.score);
        player.status = "finished";
        player.finishOrder = this.nextFinishOrder++;
        player.finishTimeSeconds = this.elapsedSeconds;
      }
    }

    if (!this.players.some((player) => player.status === "racing")) {
      this.winnerId =
        this.rankedPlayers().find((player) => player.status === "finished")?.id ?? null;
      this.phase = "results";
      this.phaseElapsedSeconds = 0;
    }
  }

  private resolveVote() {
    if (this.phase !== "voting") return;
    const counts = this.voteCounts();
    const requiredVotes = this.humanVoterCount / 2;
    this.voteDecision = counts["change-game"] > requiredVotes ? "change-game" : "rematch";
    this.phase = "decision";
    this.phaseElapsedSeconds = 0;
  }

  private get humanVoterCount() {
    return this.players.filter((player) => !player.isBot).length;
  }

  private voteCounts(): Record<SkyRunPostMatchVote, number> {
    let rematch = 0;
    let changeGame = 0;
    for (const [playerId, choice] of this.votes) {
      if (this.players.find((player) => player.id === playerId)?.isBot) continue;
      if (choice === "rematch") rematch += 1;
      else changeGame += 1;
    }
    return { rematch, "change-game": changeGame };
  }

  private toSnapshotPlayer(player: RuntimeParticipant): SkyRunMatchPlayer {
    const snapshot = player.engine.snapshot();
    return {
      id: player.id,
      name: player.name,
      characterId: player.characterId,
      isBot: player.isBot,
      phase: snapshot.phase,
      status: player.status,
      score: snapshot.score,
      distance: snapshot.distance,
      bestScore: snapshot.bestScore,
      playerX: player.engine.playerX,
      jumpHeight: snapshot.jumpHeight,
      playerVelocityY: snapshot.playerVelocityY,
      isGrounded: snapshot.isGrounded,
      coins: snapshot.coins,
      coinsCollected: snapshot.coinsCollected,
      eliminationOrder: player.eliminationOrder,
      finishOrder: player.finishOrder,
      finishTimeSeconds: player.finishTimeSeconds,
    };
  }

  private rankedPlayers() {
    return [...this.players].sort((a, b) => {
      if (a.status === "finished" && b.status !== "finished") return -1;
      if (b.status === "finished" && a.status !== "finished") return 1;
      if (a.status === "finished" && b.status === "finished") {
        return (
          (a.finishOrder ?? Number.MAX_SAFE_INTEGER) - (b.finishOrder ?? Number.MAX_SAFE_INTEGER)
        );
      }
      if (a.status === "eliminated" && b.status === "eliminated") {
        const eliminationDifference = (b.eliminationOrder ?? 0) - (a.eliminationOrder ?? 0);
        if (eliminationDifference !== 0) return eliminationDifference;
      }
      return b.engine.score - a.engine.score;
    });
  }
}
