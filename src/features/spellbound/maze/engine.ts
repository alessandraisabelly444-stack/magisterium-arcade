import {
  DECISION_DISPLAY_SECONDS,
  INITIAL_MULTIPLAYER_LIVES,
  INITIAL_SOLO_LIVES,
  MAZE_RESPAWN_PROTECTION_SECONDS,
  MAZE_SWITCH_COOLDOWN_SECONDS,
  MAZE_TEAM_SIZE,
  MAZE_TELEPORT_RANGE,
  MAZE_BIOMES,
  MAZE_COLUMNS,
  MAZE_PLAYER_KEYS,
  MAZE_POWER_RUNE_WARNING_SECONDS,
  MAZE_TILE_SIZE,
  MAZE_VOTE_SECONDS,
  MAX_MULTIPLAYER_MATCH_SECONDS,
  MAX_LOCAL_PLAYERS,
  MAX_SOLO_LIVES,
  MIN_LOCAL_PLAYERS,
  RESULTS_DISPLAY_SECONDS,
} from "./config";
import { generateMazeLayout } from "./mapGenerator";
import {
  canEnterTile,
  cellFromPosition,
  cellKey,
  chooseFleeDirection,
  findPathDirection,
  getReachableCells,
  manhattanDistance,
} from "./navigation";
import { getMazePower } from "./powers";
import { MAZE_CHARACTER_IDS } from "./powers";
import type { PlayableCharacterId } from "../types";
import type {
  MazeCell,
  MazeDirection,
  MazeEffectSnapshot,
  MazeEnemyKind,
  MazeGhostSnapshot,
  MazeItem,
  MazeLayout,
  MazeMatchEndReason,
  MazeMode,
  MazeParticipantConfig,
  MazePlayerSnapshot,
  MazePostMatchVote,
  MazeProjectileSnapshot,
  MazeSnapshot,
  MazeSwampZoneSnapshot,
  MazeTile,
} from "./types";

const PLAYER_RADIUS = 0.22;
const MULTIPLAYER_PLAYER_RADIUS = 0.32;
const GHOST_RADIUS = 0.2;
const PLAYER_BASE_SPEED = 3.15;
const GHOST_BASE_SPEED = 1.55;
const SHURIKEN_SPEED = 9.5;
const SHURIKEN_RANGE = 4.8;
const MAX_FRAME_DELTA = 0.05;
const MAX_CATCH_UP_DELTA = 1;
const PLAYER_WALL_TURN_TOLERANCE = 0.5 - PLAYER_RADIUS + 0.02;

type RuntimePlayer = Omit<MazePlayerSnapshot, "abilityCooldowns"> & {
  inputActive: boolean;
  axolotlHeartGranted: boolean;
  movementX: number;
  movementY: number;
  stopAtCenter: boolean;
  desiredDirection: MazeDirection | null;
  abilityCooldownByCharacter: Record<PlayableCharacterId, number>;
  botThinkSeconds: number;
  botTarget: MazeCell | null;
  botDifficulty?: "casual" | "balanced" | "skilled";
};

interface LevelStartPlayerState {
  characterId: PlayableCharacterId;
  direction: MazeDirection;
  roster: PlayableCharacterId[];
  activeCharacterSlot: number;
  lives: number;
  score: number;
  crystals: number;
  runes: number;
  coinsCollected: number;
  powerRunes: number;
  abilityCooldownSeconds: number;
  abilityCooldownByCharacter: Record<PlayableCharacterId, number>;
  ghostsDefeated: number;
  combo: number;
}

interface RuntimeGhost extends MazeGhostSnapshot {
  knockbackSeconds: number;
  knockbackDirection: MazeDirection | null;
  home: MazeCell;
  patrolTarget: MazeCell | null;
  pathThinkSeconds: number;
  tricksterSeconds: number;
  tricksterFleeing: boolean;
  pullTarget: MazeCell | null;
}

interface RuntimeProjectile extends MazeProjectileSnapshot {
  speed: number;
}

type RuntimeEffect = MazeEffectSnapshot;
type RuntimeSwampZone = MazeSwampZoneSnapshot;

interface MazeEngineOptions {
  mode: MazeMode;
  participants: MazeParticipantConfig[];
  seed?: number;
  bestScore?: number;
  startLevel?: number;
  initialAbilityCooldowns?: ReadonlyMap<string, Partial<Record<PlayableCharacterId, number>>>;
  initialPowerRunes?: ReadonlyMap<string, number>;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(leftX: number, leftY: number, rightX: number, rightY: number) {
  return Math.hypot(leftX - rightX, leftY - rightY);
}

function tileCenter(cell: MazeCell) {
  return { x: cell.x + 0.5, y: cell.y + 0.5 };
}

function nearTileCenter(x: number, y: number, threshold = 0.18) {
  const center = tileCenter(cellFromPosition(x, y));
  return Math.abs(center.x - x) <= threshold && Math.abs(center.y - y) <= threshold;
}

function pickSeed() {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0 || 1;
}

function makeBotRoster(seedCharacter: PlayableCharacterId, offset: number) {
  const seedIndex = Math.max(0, MAZE_CHARACTER_IDS.indexOf(seedCharacter));
  return Array.from(
    { length: MAZE_TEAM_SIZE },
    (_, index) => MAZE_CHARACTER_IDS[(seedIndex + offset + index) % MAZE_CHARACTER_IDS.length]!,
  );
}

function initialCooldownsForPlayer(
  cooldownsByPlayer: MazeEngineOptions["initialAbilityCooldowns"],
  playerId: string,
): Record<PlayableCharacterId, number> {
  const cooldowns = cooldownsByPlayer?.get(playerId);
  return Object.fromEntries(
    MAZE_CHARACTER_IDS.map((characterId) => [
      characterId,
      Math.max(0, cooldowns?.[characterId] ?? 0),
    ]),
  ) as Record<PlayableCharacterId, number>;
}

export class MazeEngine {
  readonly mode: MazeMode;
  readonly players: RuntimePlayer[];
  phase: MazeSnapshot["phase"] = "character-select";
  winnerId: string | null = null;
  matchEndReason: MazeMatchEndReason | null = null;
  voteDecision: MazePostMatchVote | null = null;

  private readonly seed: number;
  private readonly votes = new Map<string, MazePostMatchVote>();
  private globalTimeStopSeconds = 0;
  private timeNormalDisplaySeconds = 0;
  private layout!: MazeLayout;
  private grid: MazeTile[][] = [];
  private items: MazeItem[] = [];
  private ghosts: RuntimeGhost[] = [];
  private projectiles: RuntimeProjectile[] = [];
  private effects: RuntimeEffect[] = [];
  private swampZones: RuntimeSwampZone[] = [];
  private level = 1;
  private cycle = 1;
  private levelInCycle = 1;
  private countdownElapsed = 0;
  private phaseElapsed = 0;
  private elapsedSeconds = 0;
  private levelElapsedSeconds = 0;
  private matchElapsedSeconds = 0;
  private crystalsCollected = 0;
  private runesActivated = 0;
  private totalGhostsDefeated = 0;
  private nextEliminationOrder = 1;
  private nextFinishOrder = 1;
  private bestScore: number;
  private randomState: number;
  private gameOverReason: string | null = null;
  private goLabelRemaining = 0;
  private levelNeedsLoad = false;
  private levelStartPlayerStates = new Map<string, LevelStartPlayerState>();
  private levelStartTotalGhostsDefeated = 0;
  private levelStartRandomState = 1;

  constructor({
    mode,
    participants,
    seed,
    bestScore = 0,
    startLevel = 1,
    initialAbilityCooldowns,
    initialPowerRunes,
  }: MazeEngineOptions) {
    this.mode = mode;
    this.validateParticipants(participants);
    this.seed = seed ?? pickSeed();
    this.randomState = this.seed || 1;
    this.bestScore = Math.max(0, Math.floor(bestScore));
    this.level = Math.max(1, Math.floor(startLevel));
    this.players = participants.map((participant, index) => {
      const characterId = participant.roster?.[0] ?? participant.characterId;
      const roster = participant.isBot
        ? makeBotRoster(participant.characterId, index)
        : [...(participant.roster ?? [])];
      const axolotlHeartGranted = roster.includes("axolotl-mage");
      const abilityCooldownByCharacter = initialCooldownsForPlayer(
        initialAbilityCooldowns,
        participant.id,
      );
      return {
        id: participant.id,
        name: participant.name.trim() || `JOGADOR ${index + 1}`,
        characterId,
        roster,
        axolotlHeartGranted,
        activeCharacterSlot: 0,
        rosterConfirmed:
          Boolean(participant.isBot) ||
          (participant.roster?.length === MAZE_TEAM_SIZE &&
            new Set(participant.roster).size === MAZE_TEAM_SIZE),
        switchCooldownSeconds: 0,
        teleportTarget: null,
        teleportTargetValid: false,
        isBot: participant.isBot ?? false,
        controlIndex: participant.controlIndex ?? index,
        ...(participant.botDifficulty ? { botDifficulty: participant.botDifficulty } : {}),
        x: 1.5,
        y: 1.5,
        direction: "right",
        isMoving: false,
        inputActive: participant.isBot ?? false,
        movementX: 0,
        movementY: 0,
        stopAtCenter: false,
        desiredDirection: null,
        lives:
          (mode === "solo" ? INITIAL_SOLO_LIVES : INITIAL_MULTIPLAYER_LIVES) +
          Number(axolotlHeartGranted),
        score: 0,
        crystals: 0,
        runes: 0,
        coinsCollected: 0,
        powerRunes: Math.max(0, Math.floor(initialPowerRunes?.get(participant.id) ?? 0)),
        powerWarningSeconds: 0,
        ghostsDefeated: 0,
        combo: 0,
        abilityCooldownSeconds: abilityCooldownByCharacter[characterId] ?? 0,
        abilityCooldownByCharacter,
        abilityActiveSeconds: 0,
        status: "active",
        eliminationOrder: null,
        finishOrder: null,
        finishTimeSeconds: null,
        invulnerableSeconds: 0.8,
        botThinkSeconds: 0,
        botTarget: null,
      };
    });
    this.loadLevel();
    this.maybeBeginSelectedLevel();
  }

  get countdownLabel() {
    if (this.phase === "countdown")
      return String(Math.max(1, 3 - Math.floor(this.countdownElapsed)));
    return this.phase === "playing" && this.goLabelRemaining > 0 ? "VAI!" : null;
  }

  get humanVoterCount() {
    return this.players.filter((player) => !player.isBot).length;
  }

  get exitOpen() {
    return this.items.every((item) => item.kind === "coin" || item.collectedBy !== null);
  }

  setDirection(playerId: string, direction: MazeDirection) {
    if (this.phase !== "playing" && this.phase !== "countdown") return false;
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (!player || player.isBot || player.status !== "active" || player.teleportTarget)
      return false;
    if (this.mode !== "solo") {
      const vector = this.directionVector(direction);
      return this.setMovementVector(playerId, vector.x, vector.y, direction);
    }
    player.desiredDirection = direction;
    player.inputActive = true;
    player.stopAtCenter = false;
    return true;
  }

  setMovementVector(playerId: string, x: number, y: number, facing?: MazeDirection) {
    if (this.phase !== "playing" && this.phase !== "countdown") return false;
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (!player || player.isBot || player.status !== "active" || player.teleportTarget)
      return false;
    player.movementX = Math.sign(x);
    player.movementY = Math.sign(y);
    player.inputActive = player.movementX !== 0 || player.movementY !== 0;
    player.desiredDirection = null;
    player.stopAtCenter = false;
    if (facing) player.direction = facing;
    player.isMoving = false;
    return true;
  }

  clearDirection(playerId: string) {
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (!player || player.isBot) return false;
    if (this.mode !== "solo") return this.setMovementVector(playerId, 0, 0);
    player.desiredDirection = null;
    player.inputActive = false;
    if (nearTileCenter(player.x, player.y, 0.08)) {
      const center = tileCenter(cellFromPosition(player.x, player.y));
      player.x = center.x;
      player.y = center.y;
      player.stopAtCenter = false;
      player.isMoving = false;
    } else {
      player.stopAtCenter = true;
    }
    return true;
  }

  setRosterSelection(playerId: string, roster: PlayableCharacterId[]) {
    if (this.phase !== "character-select") return false;
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (!player || player.isBot || player.rosterConfirmed || roster.length > MAZE_TEAM_SIZE) {
      return false;
    }
    if (
      new Set(roster).size !== roster.length ||
      roster.some((characterId) => !MAZE_CHARACTER_IDS.includes(characterId))
    ) {
      return false;
    }
    player.roster = [...roster];
    player.activeCharacterSlot = 0;
    if (roster[0]) {
      player.characterId = roster[0];
      player.abilityCooldownSeconds = player.abilityCooldownByCharacter[roster[0]] ?? 0;
    }
    return true;
  }

  confirmRoster(playerId: string) {
    if (this.phase !== "character-select") return false;
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (
      !player ||
      player.isBot ||
      player.rosterConfirmed ||
      player.roster.length !== MAZE_TEAM_SIZE ||
      new Set(player.roster).size !== MAZE_TEAM_SIZE
    ) {
      return false;
    }
    if (player.roster.includes("axolotl-mage") && !player.axolotlHeartGranted) {
      player.lives += 1;
      player.axolotlHeartGranted = true;
    }
    player.rosterConfirmed = true;
    this.maybeBeginSelectedLevel();
    return true;
  }

  switchCharacter(playerId: string, slot: number) {
    if (this.phase !== "playing") return false;
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (
      !player ||
      player.isBot ||
      player.status !== "active" ||
      slot < 0 ||
      slot >= player.roster.length ||
      slot === player.activeCharacterSlot ||
      player.switchCooldownSeconds > 0
    ) {
      return false;
    }
    this.activateCharacterSlot(player, slot, true);
    return true;
  }

  moveTeleportTarget(playerId: string, direction: MazeDirection) {
    if (this.phase !== "playing") return false;
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (
      !player ||
      player.status !== "active" ||
      player.characterId !== "purple-rabbit-ninja" ||
      !player.teleportTarget
    ) {
      return false;
    }
    const vector = this.directionVector(direction);
    const next = { x: player.teleportTarget.x + vector.x, y: player.teleportTarget.y + vector.y };
    const reachable = getReachableCells(this.grid, cellFromPosition(player.x, player.y));
    if (
      !reachable.some((cell) => cell.x === next.x && cell.y === next.y) ||
      distance(player.x, player.y, next.x + 0.5, next.y + 0.5) > MAZE_TELEPORT_RANGE
    ) {
      return false;
    }
    player.teleportTarget = next;
    player.teleportTargetValid = this.isTeleportDestinationValid(player, next);
    return true;
  }

  cancelTeleportTarget(playerId: string) {
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (!player?.teleportTarget) return false;
    player.teleportTarget = null;
    player.teleportTargetValid = false;
    return true;
  }

  isTeleportAiming(playerId: string) {
    return Boolean(this.players.find((candidate) => candidate.id === playerId)?.teleportTarget);
  }

  setBestScore(score: number) {
    this.bestScore = Math.max(this.bestScore, Math.floor(score));
  }

  useAbility(playerId: string) {
    if (this.phase !== "playing") return false;
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (!player || player.status !== "active") return false;
    if (player.powerRunes <= 0) {
      player.powerWarningSeconds = player.isBot ? 0 : MAZE_POWER_RUNE_WARNING_SECONDS;
      return false;
    }
    if (player.characterId === "purple-rabbit-ninja" && player.teleportTarget) {
      return this.confirmTeleport(player);
    }
    const cooldown = player.abilityCooldownByCharacter[player.characterId] ?? 0;
    if (cooldown > 0) return false;

    if (player.characterId === "purple-rabbit-ninja") {
      const target = this.chooseInitialTeleportTarget(player);
      if (!target) return false;
      player.teleportTarget = target;
      player.teleportTargetValid = this.isTeleportDestinationValid(player, target);
      if (player.isBot) return this.confirmTeleport(player);
      return true;
    }

    const power = getMazePower(player.characterId);
    const origin = cellFromPosition(player.x, player.y);
    switch (player.characterId) {
      case "white-fox-ice-mage":
        for (const ghost of this.ghosts) {
          if (Math.abs(ghost.x - player.x) <= 3 && Math.abs(ghost.y - player.y) <= 3) {
            ghost.frozenSeconds = Math.max(ghost.frozenSeconds, 5);
          }
        }
        this.addEffect("ice-burst", player.x, player.y, player.direction, 0.8);
        player.abilityActiveSeconds = 5;
        break;
      case "swamp-frog-mage": {
        const reachable = getReachableCells(this.grid, origin);
        const cells = reachable.filter(
          (cell) => Math.abs(cell.x - origin.x) <= 2 && Math.abs(cell.y - origin.y) <= 2,
        );
        if (cells.length === 0) return false;
        this.swampZones.push({
          id: `swamp-${player.id}-${this.elapsedSeconds.toFixed(3)}`,
          ownerId: player.id,
          x: player.x,
          y: player.y,
          cells,
          secondsRemaining: 6,
          maxSeconds: 6,
        });
        this.addEffect("swamp-burst", player.x, player.y, player.direction, 0.7);
        player.abilityActiveSeconds = 6;
        break;
      }
      case "forge-raccoon-mage":
        for (const ghost of this.ghosts) {
          if (Math.abs(ghost.x - player.x) > 2 || Math.abs(ghost.y - player.y) > 2) continue;
          const ghostCell = cellFromPosition(ghost.x, ghost.y);
          ghost.knockbackDirection =
            chooseFleeDirection(this.grid, ghostCell, origin, ghost.direction) ?? ghost.direction;
          ghost.knockbackSeconds = Math.max(ghost.knockbackSeconds, 0.22);
          ghost.stunnedSeconds = Math.max(ghost.stunnedSeconds, 3);
        }
        this.addEffect("fire-burst", player.x, player.y, player.direction, 0.75);
        player.abilityActiveSeconds = 0.75;
        break;
      case "time-owl-mage":
        for (const ghost of this.ghosts) {
          ghost.timeStoppedSeconds = 5;
        }
        this.globalTimeStopSeconds = 5;
        this.timeNormalDisplaySeconds = 0;
        this.addEffect("time-stop", player.x, player.y, player.direction, 0.9);
        player.abilityActiveSeconds = 5;
        break;
      case "calm-capybara-mage":
        for (const ghost of this.ghosts) {
          ghost.calmariaSeconds = Math.max(ghost.calmariaSeconds, 5);
          ghost.slowedSeconds = Math.max(ghost.slowedSeconds, 5);
        }
        player.abilityActiveSeconds = 5;
        break;
      case "axolotl-mage": {
        const target = this.players
          .filter((candidate) => candidate.id !== player.id && candidate.status === "eliminated")
          .sort(
            (left, right) =>
              (right.eliminationOrder ?? -1) - (left.eliminationOrder ?? -1),
          )[0];
        if (!target) return false;
        const spawn = this.playerSpawnFor(target);
        const center = tileCenter(spawn);
        target.x = center.x;
        target.y = center.y;
        target.direction = "right";
        target.isMoving = false;
        target.inputActive = true;
        target.movementX = 0;
        target.movementY = 0;
        target.stopAtCenter = false;
        target.desiredDirection = null;
        target.lives = 1;
        target.status = "active";
        target.eliminationOrder = null;
        target.finishOrder = null;
        target.finishTimeSeconds = null;
        target.invulnerableSeconds = MAZE_RESPAWN_PROTECTION_SECONDS;
        target.switchCooldownSeconds = 0;
        target.powerWarningSeconds = 0;
        target.teleportTarget = null;
        target.teleportTargetValid = false;
        target.botThinkSeconds = 0;
        target.botTarget = null;
        player.abilityActiveSeconds = 1;
        break;
      }
    }

    player.powerRunes -= 1;
    player.powerWarningSeconds = 0;
    player.abilityCooldownByCharacter[player.characterId] = power.cooldownSeconds;
    player.abilityCooldownSeconds = power.cooldownSeconds;
    return true;
  }

  private maybeBeginSelectedLevel() {
    const ready = this.players.every(
      (player) =>
        player.isBot || (player.rosterConfirmed && player.roster.length === MAZE_TEAM_SIZE),
    );
    if (!ready) return;
    if (this.levelNeedsLoad) {
      this.loadLevel();
      this.levelNeedsLoad = false;
    }
    for (const player of this.players) {
      this.activateCharacterSlot(player, 0, false);
      player.rosterConfirmed = true;
      player.status = "active";
    }
    this.countdownElapsed = 0;
    this.phaseElapsed = 0;
    this.goLabelRemaining = 0;
    this.phase = "countdown";
    this.captureLevelStartState();
  }

  private captureLevelStartState() {
    this.levelStartPlayerStates = new Map(
      this.players.map((player): [string, LevelStartPlayerState] => [
        player.id,
        {
          characterId: player.characterId,
          direction: player.direction,
          roster: [...player.roster],
          activeCharacterSlot: player.activeCharacterSlot,
          lives: player.lives,
          score: player.score,
          crystals: player.crystals,
          runes: player.runes,
          coinsCollected: player.coinsCollected,
          powerRunes: player.powerRunes,
          abilityCooldownSeconds: player.abilityCooldownSeconds,
          abilityCooldownByCharacter: { ...player.abilityCooldownByCharacter },
          ghostsDefeated: player.ghostsDefeated,
          combo: player.combo,
        },
      ]),
    );
    this.levelStartTotalGhostsDefeated = this.totalGhostsDefeated;
    this.levelStartRandomState = this.randomState;
  }

  private activateCharacterSlot(player: RuntimePlayer, slot: number, animate: boolean) {
    const nextCharacter = player.roster[slot];
    if (!nextCharacter || nextCharacter === player.characterId) return false;
    const previousX = player.x;
    const previousY = player.y;
    player.characterId = nextCharacter;
    player.activeCharacterSlot = slot;
    player.abilityCooldownSeconds = player.abilityCooldownByCharacter[nextCharacter] ?? 0;
    player.abilityActiveSeconds = 0;
    player.teleportTarget = null;
    player.teleportTargetValid = false;
    if (animate) {
      player.switchCooldownSeconds = MAZE_SWITCH_COOLDOWN_SECONDS;
      this.addEffect("character-swap", previousX, previousY, player.direction, 0.48);
    }
    return true;
  }

  private chooseInitialTeleportTarget(player: RuntimePlayer) {
    const origin = cellFromPosition(player.x, player.y);
    const reachable = getReachableCells(this.grid, origin).filter(
      (cell) =>
        distance(player.x, player.y, cell.x + 0.5, cell.y + 0.5) <= MAZE_TELEPORT_RANGE &&
        this.isTeleportDestinationValid(player, cell),
    );
    if (reachable.length === 0) return null;
    const vector = this.directionVector(player.direction);
    const preferred = { x: player.x + vector.x * 2.5, y: player.y + vector.y * 2.5 };
    return reachable.sort(
      (left, right) =>
        distance(left.x + 0.5, left.y + 0.5, preferred.x, preferred.y) -
        distance(right.x + 0.5, right.y + 0.5, preferred.x, preferred.y),
    )[0]!;
  }

  private isTeleportDestinationValid(player: RuntimePlayer, cell: MazeCell) {
    const center = tileCenter(cell);
    const tile = this.grid[cell.y]?.[cell.x];
    if (
      !canEnterTile(tile) ||
      distance(player.x, player.y, center.x, center.y) > MAZE_TELEPORT_RANGE ||
      !this.canOccupy(center.x, center.y, PLAYER_RADIUS)
    ) {
      return false;
    }
    return this.ghosts.every((ghost) => distance(ghost.x, ghost.y, center.x, center.y) >= 0.78);
  }

  private confirmTeleport(player: RuntimePlayer) {
    const target = player.teleportTarget;
    const power = getMazePower("purple-rabbit-ninja");
    if (player.powerRunes <= 0) {
      player.powerWarningSeconds = player.isBot ? 0 : MAZE_POWER_RUNE_WARNING_SECONDS;
      return false;
    }
    if (
      !target ||
      player.characterId !== "purple-rabbit-ninja" ||
      (player.abilityCooldownByCharacter[player.characterId] ?? 0) > 0 ||
      !this.isTeleportDestinationValid(player, target)
    ) {
      player.teleportTargetValid = target ? this.isTeleportDestinationValid(player, target) : false;
      return false;
    }
    const originX = player.x;
    const originY = player.y;
    const destination = tileCenter(target);
    this.addEffect("teleport-smoke", originX, originY, player.direction, 0.42);
    player.x = destination.x;
    player.y = destination.y;
    player.isMoving = false;
    player.inputActive = false;
    player.stopAtCenter = false;
    player.desiredDirection = null;
    player.teleportTarget = null;
    player.teleportTargetValid = false;
    player.abilityActiveSeconds = 0.42;
    player.powerRunes -= 1;
    player.powerWarningSeconds = 0;
    player.abilityCooldownByCharacter[player.characterId] = power.cooldownSeconds;
    player.abilityCooldownSeconds = power.cooldownSeconds;
    this.addEffect("teleport-smoke", destination.x, destination.y, player.direction, 0.42);
    return true;
  }

  vote(playerId: string, choice: MazePostMatchVote) {
    if (this.phase !== "voting") return false;
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (!player || player.isBot || this.votes.has(playerId)) return false;
    this.votes.set(playerId, choice);
    if (this.votes.size >= this.humanVoterCount) this.resolveVote();
    return true;
  }

  advanceToNextLevel() {
    if (this.phase !== "level-clear") return false;
    const humanRosters = new Map<string, PlayableCharacterId[]>(
      this.players
        .filter((player) => !player.isBot)
        .map((player): [string, PlayableCharacterId[]] => [player.id, [...player.roster]]),
    );
    this.advanceLevel();
    for (const player of this.players) {
      player.coinsCollected = 0;
      if (player.isBot) continue;
      const roster = humanRosters.get(player.id);
      if (roster?.length === MAZE_TEAM_SIZE && new Set(roster).size === MAZE_TEAM_SIZE) {
        player.roster = roster;
        player.rosterConfirmed = true;
      }
    }
    this.maybeBeginSelectedLevel();
    return true;
  }

  retryCurrentLevel() {
    if (this.phase !== "game-over") return false;

    this.votes.clear();
    this.winnerId = null;
    this.matchEndReason = null;
    this.voteDecision = null;
    this.gameOverReason = null;
    this.elapsedSeconds = 0;
    this.levelElapsedSeconds = 0;
    this.matchElapsedSeconds = 0;
    this.totalGhostsDefeated = this.levelStartTotalGhostsDefeated;
    this.randomState = this.levelStartRandomState;
    this.nextEliminationOrder = 1;
    this.nextFinishOrder = 1;
    this.countdownElapsed = 0;
    this.phaseElapsed = 0;
    this.goLabelRemaining = 0;
    this.levelNeedsLoad = false;

    for (const player of this.players) {
      const initial = this.levelStartPlayerStates.get(player.id);
      if (initial) {
        player.characterId = initial.characterId;
        player.direction = initial.direction;
        player.roster = [...initial.roster];
        player.activeCharacterSlot = initial.activeCharacterSlot;
        player.lives = initial.lives;
        player.score = initial.score;
        player.crystals = initial.crystals;
        player.runes = initial.runes;
        player.coinsCollected = initial.coinsCollected;
        player.powerRunes = initial.powerRunes;
        player.abilityCooldownSeconds = initial.abilityCooldownSeconds;
        player.abilityCooldownByCharacter = { ...initial.abilityCooldownByCharacter };
        player.ghostsDefeated = initial.ghostsDefeated;
        player.combo = initial.combo;
      }
      player.rosterConfirmed = true;
      player.inputActive = player.isBot;
      player.movementX = 0;
      player.movementY = 0;
      player.stopAtCenter = false;
      player.desiredDirection = null;
      player.isMoving = false;
      player.switchCooldownSeconds = 0;
      player.abilityActiveSeconds = 0;
      player.powerWarningSeconds = 0;
      player.teleportTarget = null;
      player.teleportTargetValid = false;
    }

    this.loadLevel();
    for (const player of this.players) {
      const initial = this.levelStartPlayerStates.get(player.id);
      if (initial) player.direction = initial.direction;
    }
    this.phase = "countdown";
    return true;
  }

  step(deltaSeconds: number) {
    const totalDelta = clamp(deltaSeconds, 0, MAX_CATCH_UP_DELTA);
    if (totalDelta <= 0) return;
    const substepCount = Math.ceil(totalDelta / MAX_FRAME_DELTA);
    const dt = totalDelta / substepCount;
    for (let index = 0; index < substepCount; index += 1) this.stepFrame(dt);
  }

  private stepFrame(dt: number) {
    if (dt <= 0) return;

    if (this.phase === "countdown") {
      this.countdownElapsed += dt;
      if (this.countdownElapsed >= 3) {
        this.phase = "playing";
        this.goLabelRemaining = 0.55;
      }
      return;
    }

    if (this.phase === "level-clear") return;

    if (this.phase === "results") {
      this.phaseElapsed += dt;
      if (this.phaseElapsed >= RESULTS_DISPLAY_SECONDS) {
        this.phase = "voting";
        this.phaseElapsed = 0;
      }
      return;
    }

    if (this.phase === "voting") {
      this.phaseElapsed += dt;
      if (this.phaseElapsed >= MAZE_VOTE_SECONDS) this.resolveVote();
      return;
    }

    if (this.phase === "decision") {
      this.phaseElapsed += dt;
      if (this.phaseElapsed >= DECISION_DISPLAY_SECONDS) {
        this.phase = this.voteDecision === "change-game" ? "change-game" : "next-level";
      }
      return;
    }

    if (this.phase !== "playing") return;

    this.elapsedSeconds += dt;
    this.levelElapsedSeconds += dt;
    this.matchElapsedSeconds += dt;
    this.goLabelRemaining = Math.max(0, this.goLabelRemaining - dt);
    this.updateTimers(dt);
    this.stepBots(dt);
    this.stepPlayers(dt);
    this.stepGhosts(dt);
    this.stepProjectiles(dt);
    this.stepEffects(dt);
    this.checkItemPickups();
    this.checkPlayerCollisions();
    this.checkExits();

    if (this.mode !== "solo") {
      const humanPlayers = this.players.filter((player) => !player.isBot);
      if (humanPlayers.every((player) => player.status !== "active")) {
        this.finishMatch("all-inactive");
      } else if (this.matchElapsedSeconds >= MAX_MULTIPLAYER_MATCH_SECONDS) {
        this.finishMatch("time-limit");
      }
    }
  }

  snapshot(): MazeSnapshot {
    const players = this.players.map((player) => this.snapshotPlayer(player));
    return {
      phase: this.phase,
      countdownLabel: this.countdownLabel,
      level: this.level,
      cycle: this.cycle,
      levelInCycle: this.levelInCycle,
      biome: this.layout.biome,
      width: this.layout.width,
      height: this.layout.height,
      grid: this.grid.map((row) => [...row]),
      exit: { ...this.layout.exit },
      exitOpen: this.exitOpen,
      collectiblesCollected: this.items.filter(
        (item) => item.kind !== "coin" && item.collectedBy !== null,
      ).length,
      collectiblesTotal: this.items.filter((item) => item.kind !== "coin").length,
      items: this.items.map((item) => ({ ...item })),
      players,
      ranking: this.rankedPlayers().map((player) => this.snapshotPlayer(player)),
      ghosts: this.ghosts.map((ghost) => ({
        id: ghost.id,
        kind: ghost.kind,
        x: ghost.x,
        y: ghost.y,
        direction: ghost.direction,
        stunnedSeconds: ghost.stunnedSeconds,
        frozenSeconds: ghost.frozenSeconds,
        timeStoppedSeconds: ghost.timeStoppedSeconds,
        fleeingSeconds: ghost.fleeingSeconds,
        slowedSeconds: ghost.slowedSeconds,
        calmariaSeconds: ghost.calmariaSeconds,
      })),
      projectiles: this.projectiles.map(({ speed: _speed, ...projectile }) => ({ ...projectile })),
      effects: this.effects.map((effect) => ({ ...effect })),
      swampZones: this.swampZones.map((zone) => ({
        ...zone,
        cells: zone.cells.map((cell) => ({ ...cell })),
      })),
      crystalsCollected: this.crystalsCollected,
      runesActivated: this.runesActivated,
      targetCrystals: this.layout.targetCrystals,
      targetRunes: this.layout.targetRunes,
      elapsedSeconds: this.elapsedSeconds,
      matchElapsedSeconds: this.matchElapsedSeconds,
      ghostsDefeated: this.totalGhostsDefeated,
      globalTimeStopSeconds: this.globalTimeStopSeconds,
      timeNormalDisplaySeconds: this.timeNormalDisplaySeconds,
      winnerId: this.winnerId,
      matchEndReason: this.matchEndReason,
      gameOverScore: this.phase === "game-over" ? (players[0]?.score ?? 0) : 0,
      gameOverBestScore: this.bestScore,
      gameOverLevel: this.phase === "game-over" ? this.level : 0,
      gameOverGhostsDefeated: this.phase === "game-over" ? (players[0]?.ghostsDefeated ?? 0) : 0,
      gameOverReason: this.phase === "game-over" ? this.gameOverReason : null,
      matchTotalSeconds: this.matchElapsedSeconds,
      votingSecondsRemaining:
        this.phase === "voting" ? Math.max(0, Math.ceil(MAZE_VOTE_SECONDS - this.phaseElapsed)) : 0,
      decisionSecondsRemaining:
        this.phase === "decision" ? Math.max(0, DECISION_DISPLAY_SECONDS - this.phaseElapsed) : 0,
      voteCounts: this.voteCounts(),
      humanVoterCount: this.humanVoterCount,
      votedPlayerIds: [...this.votes.keys()],
      voteDecision: this.voteDecision,
    };
  }

  private validateParticipants(participants: MazeParticipantConfig[]) {
    if (this.mode === "solo") {
      if (participants.length !== 1 || participants[0]?.isBot) {
        throw new RangeError("O modo Solo do Labirinto Mágico aceita um jogador humano.");
      }
      return;
    }
    if (participants.length < MIN_LOCAL_PLAYERS || participants.length > MAX_LOCAL_PLAYERS) {
      throw new RangeError(
        `O multiplayer do labirinto aceita de ${MIN_LOCAL_PLAYERS} a ${MAX_LOCAL_PLAYERS} participantes.`,
      );
    }
    if (!participants.some((participant) => !participant.isBot)) {
      throw new RangeError("A partida precisa ter pelo menos um jogador humano.");
    }
  }

  private loadLevel() {
    this.cycle = Math.floor((this.level - 1) / MAZE_BIOMES.length) + 1;
    this.levelInCycle = ((this.level - 1) % MAZE_BIOMES.length) + 1;
    this.layout = generateMazeLayout(this.level, this.cycle, this.seed, this.players.length);
    this.grid = this.layout.grid.map((row) => [...row]);
    this.items = this.layout.items.map((item) => ({ ...item }));
    this.crystalsCollected = 0;
    this.runesActivated = 0;
    this.projectiles = [];
    this.effects = [];
    this.swampZones = [];
    this.globalTimeStopSeconds = 0;
    this.timeNormalDisplaySeconds = 0;
    this.levelElapsedSeconds = 0;
    this.ghosts = this.layout.ghostSpawns.map((cell, index) => {
      const center = tileCenter(cell);
      const kinds: MazeEnemyKind[] = ["pursuer", "interceptor", "patroller", "trickster"];
      return {
        id: `spirit-${this.level}-${index}`,
        kind: kinds[index % kinds.length]!,
        x: center.x,
        y: center.y,
        direction: index % 2 === 0 ? "left" : "up",
        stunnedSeconds: 0.7 + index * 0.08,
        frozenSeconds: 0,
        timeStoppedSeconds: 0,
        fleeingSeconds: 0,
        slowedSeconds: 0,
        calmariaSeconds: 0,
        knockbackSeconds: 0,
        knockbackDirection: null,
        home: { ...cell },
        patrolTarget: null,
        pathThinkSeconds: 0,
        tricksterSeconds: 2.2 + index * 0.7,
        tricksterFleeing: false,
        pullTarget: null,
      };
    });

    this.players.forEach((player) => {
      const spawn = this.playerSpawnFor(player);
      const center = tileCenter(spawn);
      player.x = center.x;
      player.y = center.y;
      player.direction = player.inputActive
        ? (player.desiredDirection ?? player.direction)
        : "right";
      if (!player.inputActive) player.desiredDirection = null;
      player.stopAtCenter = false;
      player.isMoving = false;
      player.status = "active";
      player.eliminationOrder = null;
      player.finishOrder = null;
      player.finishTimeSeconds = null;
      player.invulnerableSeconds = Math.max(player.invulnerableSeconds, 0.8);
      player.botTarget = null;
      player.botThinkSeconds = 0;
      player.abilityActiveSeconds = 0;
      player.powerWarningSeconds = 0;
      player.teleportTarget = null;
      player.teleportTargetValid = false;
    });
  }

  private updateTimers(dt: number) {
    for (const player of this.players) {
      for (const characterId of MAZE_CHARACTER_IDS) {
        player.abilityCooldownByCharacter[characterId] = Math.max(
          0,
          (player.abilityCooldownByCharacter[characterId] ?? 0) - dt,
        );
      }
      player.abilityCooldownSeconds = player.abilityCooldownByCharacter[player.characterId] ?? 0;
      player.switchCooldownSeconds = Math.max(0, player.switchCooldownSeconds - dt);
      player.abilityActiveSeconds = Math.max(0, player.abilityActiveSeconds - dt);
      player.powerWarningSeconds = Math.max(0, player.powerWarningSeconds - dt);
      player.invulnerableSeconds = Math.max(0, player.invulnerableSeconds - dt);
    }
    if (this.globalTimeStopSeconds > 0) {
      const remaining = Math.max(0, this.globalTimeStopSeconds - dt);
      this.globalTimeStopSeconds = remaining < 1e-8 ? 0 : remaining;
      if (this.globalTimeStopSeconds === 0) this.timeNormalDisplaySeconds = 1.2;
    } else {
      this.timeNormalDisplaySeconds = Math.max(0, this.timeNormalDisplaySeconds - dt);
    }
    for (const ghost of this.ghosts) {
      const timeWasStopped = ghost.timeStoppedSeconds > 0;
      const remainingTimeStopped = Math.max(0, ghost.timeStoppedSeconds - dt);
      ghost.timeStoppedSeconds = remainingTimeStopped < 1e-8 ? 0 : remainingTimeStopped;
      if (timeWasStopped) continue;
      ghost.stunnedSeconds = Math.max(0, ghost.stunnedSeconds - dt);
      ghost.frozenSeconds = Math.max(0, ghost.frozenSeconds - dt);
      ghost.fleeingSeconds = Math.max(0, ghost.fleeingSeconds - dt);
      ghost.slowedSeconds = Math.max(0, ghost.slowedSeconds - dt);
      ghost.calmariaSeconds = Math.max(0, ghost.calmariaSeconds - dt);
    }
  }

  private stepBots(dt: number) {
    for (const player of this.players) {
      if (!player.isBot || player.status !== "active") continue;
      player.botThinkSeconds -= dt;
      if (player.botThinkSeconds > 0) continue;
      const interval =
        player.botDifficulty === "skilled" ? 0.18 : player.botDifficulty === "casual" ? 0.42 : 0.28;
      player.botThinkSeconds = interval;

      const activeGhost = this.ghosts
        .filter(
          (ghost) =>
            ghost.stunnedSeconds <= 0 && ghost.frozenSeconds <= 0 && ghost.timeStoppedSeconds <= 0,
        )
        .sort(
          (left, right) =>
            distance(player.x, player.y, left.x, left.y) -
            distance(player.x, player.y, right.x, right.y),
        )[0];
      const hasEliminatedAlly =
        player.characterId === "axolotl-mage" &&
        this.players.some((candidate) => candidate.id !== player.id && candidate.status === "eliminated");
      if (
        player.abilityCooldownSeconds <= 0 &&
        player.powerRunes > 0 &&
        (hasEliminatedAlly ||
          (activeGhost && distance(player.x, player.y, activeGhost.x, activeGhost.y) < 2.8))
      ) {
        this.useAbility(player.id);
      }

      const target = this.chooseBotTarget(player);
      player.botTarget = target;
      const currentCell = cellFromPosition(player.x, player.y);
      const nearbyThreat =
        activeGhost &&
        manhattanDistance(currentCell, cellFromPosition(activeGhost.x, activeGhost.y)) <= 2;
      const direction = nearbyThreat
        ? chooseFleeDirection(
            this.grid,
            currentCell,
            cellFromPosition(activeGhost.x, activeGhost.y),
            player.direction,
          )
        : target
          ? findPathDirection(this.grid, currentCell, target, player.direction)
          : null;
      if (direction) player.desiredDirection = direction;
    }
  }

  private chooseBotTarget(player: RuntimePlayer) {
    if (this.exitOpen) return { ...this.layout.exit };
    const uncollectedItems = this.items.filter(
      (item) => item.collectedBy === null && item.kind !== "coin",
    );
    const powerRuneItems = uncollectedItems.filter((item) => item.kind === "power-rune");
    const requiredKind = this.crystalsCollected < this.layout.targetCrystals ? "crystal" : "rune";
    const preferredItems = this.items.filter(
      (item) => item.collectedBy === null && item.kind === requiredKind,
    );
    const candidates =
      player.powerRunes <= 0 && powerRuneItems.length > 0
        ? powerRuneItems
        : preferredItems.length > 0
          ? preferredItems
          : uncollectedItems;
    const reservedTargets = new Set(
      this.players
        .filter(
          (other) =>
            other.id !== player.id &&
            other.isBot &&
            other.status === "active" &&
            other.botTarget !== null,
        )
        .map((other) => cellKey(other.botTarget!)),
    );
    const unreservedItems = candidates.filter((item) => !reservedTargets.has(cellKey(item)));
    const fallbackUnreservedItems = uncollectedItems.filter(
      (item) => !reservedTargets.has(cellKey(item)),
    );
    const availableItems =
      unreservedItems.length > 0
        ? unreservedItems
        : fallbackUnreservedItems.length > 0
          ? fallbackUnreservedItems
          : uncollectedItems;
    const targetItem = [...availableItems].sort(
      (left, right) =>
        manhattanDistance(cellFromPosition(player.x, player.y), left) -
        manhattanDistance(cellFromPosition(player.x, player.y), right),
    )[0];
    return targetItem ? { x: targetItem.x, y: targetItem.y } : { ...this.layout.exit };
  }

  private stepPlayers(dt: number) {
    const difficultyRank = this.level + this.cycle - 1;
    const playerSpeed = PLAYER_BASE_SPEED + Math.min(0.35, difficultyRank * 0.015);
    const playerRadius = this.mode === "solo" ? PLAYER_RADIUS : MULTIPLAYER_PLAYER_RADIUS;
    for (const player of this.players) {
      if (player.status !== "active") {
        player.isMoving = false;
        continue;
      }
      if (!player.isBot && player.teleportTarget) {
        player.isMoving = false;
        continue;
      }
      if (this.mode !== "solo" && !player.isBot) {
        this.stepLocalPlayer(player, playerSpeed, dt, playerRadius);
        const localTile = this.grid[Math.floor(player.y)]?.[Math.floor(player.x)];
        if (player.inputActive && localTile === "special") {
          player.abilityActiveSeconds = Math.max(player.abilityActiveSeconds, 0.04);
        }
        continue;
      }
      if (!player.isBot && !player.inputActive && !player.stopAtCenter) {
        player.isMoving = false;
        continue;
      }
      const currentDirectionBlocked = !this.canMoveDirection(player.x, player.y, player.direction);
      const canTurnAtWall =
        currentDirectionBlocked && nearTileCenter(player.x, player.y, PLAYER_WALL_TURN_TOLERANCE);
      if (
        player.desiredDirection &&
        (nearTileCenter(player.x, player.y) || canTurnAtWall) &&
        this.canMoveDirection(player.x, player.y, player.desiredDirection)
      ) {
        const center = tileCenter(cellFromPosition(player.x, player.y));
        player.x = center.x;
        player.y = center.y;
        player.direction = player.desiredDirection;
        player.desiredDirection = null;
      }
      const vector = this.directionVector(player.direction);
      const nextX = player.x + vector.x * playerSpeed * dt;
      const nextY = player.y + vector.y * playerSpeed * dt;
      if (this.canOccupy(nextX, nextY, PLAYER_RADIUS)) {
        player.x = nextX;
        player.y = nextY;
        player.isMoving = true;
      } else {
        player.isMoving = false;
        if (
          !player.isBot &&
          !player.inputActive &&
          player.stopAtCenter &&
          nearTileCenter(player.x, player.y, PLAYER_WALL_TURN_TOLERANCE)
        ) {
          const center = tileCenter(cellFromPosition(player.x, player.y));
          player.x = center.x;
          player.y = center.y;
          player.stopAtCenter = false;
        }
      }

      if (
        !player.isBot &&
        !player.inputActive &&
        player.stopAtCenter &&
        nearTileCenter(player.x, player.y, 0.08)
      ) {
        const center = tileCenter(cellFromPosition(player.x, player.y));
        player.x = center.x;
        player.y = center.y;
        player.stopAtCenter = false;
        player.isMoving = false;
      }

      const tile = this.grid[Math.floor(player.y)]?.[Math.floor(player.x)];
      if (tile === "special") {
        player.abilityActiveSeconds = Math.max(player.abilityActiveSeconds, 0.04);
      }
    }
  }

  private stepLocalPlayer(player: RuntimePlayer, speed: number, dt: number, radius: number) {
    if (!player.inputActive || (player.movementX === 0 && player.movementY === 0)) {
      player.isMoving = false;
      return;
    }
    const diagonal = player.movementX !== 0 && player.movementY !== 0;
    const step = speed * dt;
    const magnitude = Math.hypot(player.movementX, player.movementY);
    const deltaX = (player.movementX / magnitude) * step;
    const deltaY = (player.movementY / magnitude) * step;
    const canMoveX = deltaX === 0 || this.canOccupy(player.x + deltaX, player.y, radius);
    let moved = false;
    if (deltaX !== 0 && canMoveX) {
      player.x += deltaX;
      moved = true;
    }
    const slideY = diagonal && !canMoveX ? player.movementY * step : deltaY;
    if (slideY !== 0 && this.canOccupy(player.x, player.y + slideY, radius)) {
      player.y += slideY;
      moved = true;
    } else if (diagonal && canMoveX) {
      const slideX = player.x - deltaX + player.movementX * step;
      if (this.canOccupy(slideX, player.y, radius)) {
        player.x = slideX;
        moved = true;
      }
    }
    player.isMoving = moved;
  }

  private stepGhosts(dt: number) {
    const difficultyRank = this.level + this.cycle - 1;
    const speed = GHOST_BASE_SPEED + Math.min(0.48, difficultyRank * 0.035);
    for (const ghost of this.ghosts) {
      if (ghost.frozenSeconds > 0 || ghost.timeStoppedSeconds > 0) continue;
      if (ghost.knockbackSeconds > 0 && ghost.knockbackDirection) {
        this.moveAgent(ghost, ghost.knockbackDirection, 4.6, dt, GHOST_RADIUS);
        ghost.knockbackSeconds = Math.max(0, ghost.knockbackSeconds - dt);
        if (ghost.knockbackSeconds === 0) ghost.knockbackDirection = null;
      }
      if (ghost.stunnedSeconds > 0) continue;
      const targetPlayer = this.closestActivePlayer(ghost.x, ghost.y);
      if (!targetPlayer) continue;
      ghost.pathThinkSeconds -= dt;

      if (ghost.pullTarget) {
        const destination = tileCenter(ghost.pullTarget);
        const dx = destination.x - ghost.x;
        const dy = destination.y - ghost.y;
        const pullDirection: MazeDirection =
          Math.abs(dx) > Math.abs(dy) ? (dx >= 0 ? "right" : "left") : dy >= 0 ? "down" : "up";
        const pulled = this.moveAgent(ghost, pullDirection, 3.2, dt, GHOST_RADIUS);
        if (!pulled || distance(ghost.x, ghost.y, destination.x, destination.y) < 0.12) {
          ghost.x = destination.x;
          ghost.y = destination.y;
          ghost.pullTarget = null;
        }
        continue;
      }

      if (ghost.kind === "trickster") {
        ghost.tricksterSeconds -= dt;
        if (ghost.tricksterSeconds <= 0) {
          ghost.tricksterFleeing = !ghost.tricksterFleeing;
          ghost.tricksterSeconds = 3.2 + this.random() * 1.6;
        }
      }

      const currentCell = cellFromPosition(ghost.x, ghost.y);
      const atCenter = nearTileCenter(ghost.x, ghost.y, 0.16);
      if (
        atCenter &&
        (ghost.pathThinkSeconds <= 0 || !this.canMoveDirection(ghost.x, ghost.y, ghost.direction))
      ) {
        const target = this.ghostTarget(ghost, targetPlayer);
        if (ghost.fleeingSeconds > 0 || (ghost.kind === "trickster" && ghost.tricksterFleeing)) {
          const threat = cellFromPosition(targetPlayer.x, targetPlayer.y);
          ghost.direction =
            chooseFleeDirection(this.grid, currentCell, threat, ghost.direction) ?? ghost.direction;
        } else if (ghost.kind === "patroller") {
          if (!ghost.patrolTarget || manhattanDistance(currentCell, ghost.patrolTarget) <= 1) {
            ghost.patrolTarget = this.choosePatrolTarget(currentCell);
          }
          ghost.direction =
            findPathDirection(
              this.grid,
              currentCell,
              ghost.patrolTarget ?? target,
              ghost.direction,
            ) ?? ghost.direction;
        } else {
          ghost.direction =
            findPathDirection(this.grid, currentCell, target, ghost.direction) ?? ghost.direction;
        }
        ghost.pathThinkSeconds = Math.max(0.18, 0.46 - difficultyRank * 0.012);
      }

      const tile = this.grid[Math.floor(ghost.y)]?.[Math.floor(ghost.x)];
      const specialSlow =
        tile === "special" && ["frost", "mosswood", "chronolibrary"].includes(this.layout.biome.id)
          ? 0.72
          : 1;
      const ghostCell = cellFromPosition(ghost.x, ghost.y);
      const insideSwamp = this.swampZones.some((zone) =>
        zone.cells.some((cell) => cell.x === ghostCell.x && cell.y === ghostCell.y),
      );
      const slowFactor =
        insideSwamp || ghost.calmariaSeconds > 0
          ? 0.42
          : ghost.slowedSeconds > 0
            ? 0.55
            : specialSlow;
      const moveSpeed = speed * slowFactor;
      this.moveAgent(ghost, ghost.direction, moveSpeed, dt, GHOST_RADIUS);
    }
  }

  private ghostTarget(ghost: RuntimeGhost, nearest: RuntimePlayer): MazeCell {
    const nearestCell = cellFromPosition(nearest.x, nearest.y);
    if (ghost.kind !== "interceptor") return nearestCell;
    const vector = this.directionVector(nearest.direction);
    let predicted = { ...nearestCell };
    for (let step = 0; step < 2; step += 1) {
      const next = { x: predicted.x + vector.x, y: predicted.y + vector.y };
      if (!canEnterTile(this.grid[next.y]?.[next.x])) break;
      predicted = next;
    }
    return predicted;
  }

  private choosePatrolTarget(from: MazeCell) {
    const reachable = getReachableCells(this.grid, from).filter(
      (cell) => manhattanDistance(cell, from) >= 4,
    );
    if (reachable.length === 0) return { ...this.layout.start };
    const farCells = reachable.filter((cell) => manhattanDistance(cell, from) >= 6);
    const choices = farCells.length > 0 ? farCells : reachable;
    return { ...choices[Math.floor(this.random() * choices.length)]! };
  }

  private stepProjectiles(dt: number) {
    const remaining: RuntimeProjectile[] = [];
    for (const projectile of this.projectiles) {
      const vector = this.directionVector(projectile.direction);
      const distanceToMove = Math.min(projectile.speed * dt, projectile.remainingDistance);
      let blocked = false;
      let hit = false;
      const substeps = Math.max(1, Math.ceil(distanceToMove / 0.08));
      const subDistance = distanceToMove / substeps;
      for (let step = 0; step < substeps; step += 1) {
        const nextX = projectile.x + vector.x * subDistance;
        const nextY = projectile.y + vector.y * subDistance;
        if (!this.canOccupy(nextX, nextY, 0.08)) {
          blocked = true;
          break;
        }
        projectile.x = nextX;
        projectile.y = nextY;
        projectile.remainingDistance -= subDistance;
        const ghost = this.ghosts.find(
          (candidate) =>
            candidate.stunnedSeconds <= 0 &&
            distance(candidate.x, candidate.y, projectile.x, projectile.y) < 0.38,
        );
        if (ghost) {
          ghost.stunnedSeconds = 1.2;
          this.awardGhost(this.players.find((player) => player.id === projectile.ownerId));
          this.addEffect("hit", projectile.x, projectile.y, projectile.direction, 0.35);
          hit = true;
          break;
        }
      }
      if (!blocked && !hit && projectile.remainingDistance > 0.02) remaining.push(projectile);
    }
    this.projectiles = remaining;
  }

  private stepEffects(dt: number) {
    this.effects = this.effects
      .map((effect) => ({ ...effect, secondsRemaining: effect.secondsRemaining - dt }))
      .filter((effect) => effect.secondsRemaining > 0);
    this.swampZones = this.swampZones
      .map((zone) => ({ ...zone, secondsRemaining: zone.secondsRemaining - dt }))
      .filter((zone) => zone.secondsRemaining > 0);
  }

  private checkItemPickups() {
    for (const player of this.players) {
      if (player.status !== "active") continue;
      for (const item of this.items) {
        if (
          item.collectedBy !== null ||
          (item.kind === "coin" && player.isBot) ||
          distance(player.x, player.y, item.x + 0.5, item.y + 0.5) > 0.36
        )
          continue;
        item.collectedBy = player.id;
        if (item.kind === "coin") {
          player.coinsCollected += 1;
        } else if (item.kind === "crystal") {
          this.crystalsCollected += 1;
          player.crystals += 1;
          player.combo += 1;
          player.score += 45 + Math.min(45, player.combo * 3);
        } else if (item.kind === "rune") {
          this.runesActivated += 1;
          player.runes += 1;
          player.combo += 2;
          player.score += 130 + Math.min(45, player.combo * 4);
        } else {
          player.powerRunes += 1;
          player.powerWarningSeconds = 0;
        }
      }
    }
  }

  private playerSpawnFor(player: RuntimePlayer) {
    return (
      this.layout.playerSpawns[player.controlIndex % this.layout.playerSpawns.length] ??
      this.layout.start
    );
  }

  private checkPlayerCollisions() {
    for (const player of this.players) {
      if (player.status !== "active" || player.invulnerableSeconds > 0) continue;
      const ghost = this.ghosts.find(
        (candidate) =>
          candidate.stunnedSeconds <= 0 &&
          candidate.frozenSeconds <= 0 &&
          candidate.timeStoppedSeconds <= 0 &&
          distance(player.x, player.y, candidate.x, candidate.y) < 0.42,
      );
      if (ghost) this.damagePlayer(player, "Um espírito alcançou você.");
    }
  }

  private checkExits() {
    if (!this.exitOpen) return;
    for (const player of this.players) {
      if (
        player.status !== "active" ||
        distance(player.x, player.y, this.layout.exit.x + 0.5, this.layout.exit.y + 0.5) > 0.42
      )
        continue;
      player.status = "finished";
      player.finishOrder = this.nextFinishOrder++;
      player.finishTimeSeconds =
        this.mode === "solo" ? this.levelElapsedSeconds : this.matchElapsedSeconds;
      player.score += 250 + Math.max(0, Math.floor(120 - player.finishTimeSeconds * 2));
      if (!player.isBot) {
        this.phase = "level-clear";
        this.phaseElapsed = 0;
        this.bestScore = Math.max(this.bestScore, player.score);
        return;
      }
    }
  }

  private damagePlayer(player: RuntimePlayer, reason: string) {
    if (player.status !== "active" || player.invulnerableSeconds > 0) return;
    player.lives = Math.max(0, player.lives - 1);
    player.combo = 0;
    player.invulnerableSeconds = 0;
    player.abilityActiveSeconds = 0;
    player.powerWarningSeconds = 0;
    player.teleportTarget = null;
    player.teleportTargetValid = false;
    player.isMoving = false;
    this.addEffect("hit", player.x, player.y, player.direction, 0.45);
    if (player.lives <= 0) {
      player.status = "eliminated";
      player.inputActive = false;
      player.stopAtCenter = false;
      player.desiredDirection = null;
      player.eliminationOrder = this.nextEliminationOrder++;
      if (this.mode === "solo") {
        this.phase = "game-over";
        this.gameOverReason = reason;
        this.bestScore = Math.max(this.bestScore, player.score);
      }
      return;
    }
    const spawn = this.playerSpawnFor(player);
    const center = tileCenter(spawn);
    player.x = center.x;
    player.y = center.y;
    player.invulnerableSeconds = MAZE_RESPAWN_PROTECTION_SECONDS;
    player.direction = player.inputActive ? (player.desiredDirection ?? player.direction) : "right";
    if (!player.inputActive) player.desiredDirection = null;
    player.stopAtCenter = false;
  }

  private finishMatch(reason: MazeMatchEndReason) {
    if (this.phase !== "playing" || this.mode === "solo") return;
    const humanFinisher = this.players.find(
      (player) => !player.isBot && player.status === "finished",
    );
    if (humanFinisher) {
      this.phase = "level-clear";
      this.phaseElapsed = 0;
      this.bestScore = Math.max(this.bestScore, humanFinisher.score);
      return;
    }

    this.winnerId = null;
    this.matchEndReason = reason;
    this.gameOverReason =
      reason === "time-limit"
        ? "O tempo acabou antes de a fase ser concluída."
        : "Todos os jogadores perderam as vidas antes de concluir a fase.";
    this.phase = "game-over";
    this.phaseElapsed = 0;
  }

  private advanceLevel() {
    this.level += 1;
    if (this.levelInCycle === MAZE_BIOMES.length) {
      for (const player of this.players) player.lives = Math.min(MAX_SOLO_LIVES, player.lives + 1);
    }
    this.levelNeedsLoad = true;
    this.phase = "character-select";
    this.phaseElapsed = 0;
    for (const player of this.players) {
      player.roster = player.isBot
        ? makeBotRoster(
            MAZE_CHARACTER_IDS[(this.level + player.controlIndex) % MAZE_CHARACTER_IDS.length]!,
            player.controlIndex,
          )
        : [];
      player.rosterConfirmed = player.isBot;
      player.activeCharacterSlot = 0;
      player.switchCooldownSeconds = 0;
      player.teleportTarget = null;
      player.teleportTargetValid = false;
      player.abilityActiveSeconds = 0;
      if (player.roster[0]) {
        player.characterId = player.roster[0];
        player.abilityCooldownSeconds = player.abilityCooldownByCharacter[player.characterId] ?? 0;
      }
    }
  }

  private openGate(cell: MazeCell, player: RuntimePlayer, effectKind: MazeEffectSnapshot["kind"]) {
    if (this.grid[cell.y]?.[cell.x] !== "breakable") return false;
    this.grid[cell.y]![cell.x] = "path";
    player.score += 60;
    this.addEffect(effectKind, cell.x + 0.5, cell.y + 0.5, player.direction, 0.45);
    return true;
  }

  private awardGhost(player: RuntimePlayer | undefined) {
    if (!player) return;
    player.ghostsDefeated += 1;
    player.score += 180;
    player.combo += 1;
    this.totalGhostsDefeated += 1;
  }

  private addEffect(
    kind: MazeEffectSnapshot["kind"],
    x: number,
    y: number,
    direction: MazeDirection,
    seconds: number,
    target?: { x: number; y: number },
  ) {
    const id = `fx-${Math.floor(this.elapsedSeconds * 1000)}-${this.effects.length}`;
    this.effects.push({
      id,
      kind,
      x,
      y,
      direction,
      secondsRemaining: seconds,
      maxSeconds: seconds,
      ...(target ? { targetX: target.x, targetY: target.y } : {}),
    });
  }

  private closestActivePlayer(x: number, y: number) {
    return this.players
      .filter((player) => player.status === "active")
      .sort((left, right) => distance(x, y, left.x, left.y) - distance(x, y, right.x, right.y))[0];
  }

  private canMoveDirection(x: number, y: number, direction: MazeDirection) {
    const vector = this.directionVector(direction);
    const radius = this.mode === "solo" ? PLAYER_RADIUS : MULTIPLAYER_PLAYER_RADIUS;
    return this.canOccupy(x + vector.x * 0.12, y + vector.y * 0.12, radius);
  }

  private canOccupy(x: number, y: number, radius: number) {
    const samplePoints = [
      [x - radius, y - radius],
      [x + radius, y - radius],
      [x - radius, y + radius],
      [x + radius, y + radius],
    ] as const;
    return samplePoints.every(([sampleX, sampleY]) => {
      const tile = this.grid[Math.floor(sampleY)]?.[Math.floor(sampleX)];
      return canEnterTile(tile);
    });
  }

  private moveAgent(
    agent: { x: number; y: number; direction: MazeDirection },
    direction: MazeDirection,
    speed: number,
    dt: number,
    radius: number,
  ) {
    const vector = this.directionVector(direction);
    const nextX = agent.x + vector.x * speed * dt;
    const nextY = agent.y + vector.y * speed * dt;
    if (this.canOccupy(nextX, nextY, radius)) {
      agent.x = nextX;
      agent.y = nextY;
      agent.direction = direction;
      return true;
    }
    if (nearTileCenter(agent.x, agent.y, 0.32)) {
      const center = tileCenter(cellFromPosition(agent.x, agent.y));
      agent.x = center.x;
      agent.y = center.y;
    }
    return false;
  }

  private directionVector(direction: MazeDirection) {
    const vector = {
      up: { x: 0, y: -1 },
      right: { x: 1, y: 0 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
    }[direction];
    return vector;
  }

  private random() {
    this.randomState += 0x6d2b79f5;
    let value = this.randomState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  private rankedPlayers() {
    return [...this.players].sort((left, right) => {
      if (left.status === "finished" && right.status !== "finished") return -1;
      if (right.status === "finished" && left.status !== "finished") return 1;
      if (left.status === "finished" && right.status === "finished") {
        return (
          (left.finishOrder ?? Number.MAX_SAFE_INTEGER) -
          (right.finishOrder ?? Number.MAX_SAFE_INTEGER)
        );
      }
      if (left.status === "eliminated" && right.status === "eliminated") {
        const eliminationDifference = (right.eliminationOrder ?? 0) - (left.eliminationOrder ?? 0);
        if (eliminationDifference !== 0) return eliminationDifference;
      }
      if (left.score !== right.score) return right.score - left.score;
      const objectiveDifference = right.crystals + right.runes - (left.crystals + left.runes);
      if (objectiveDifference !== 0) return objectiveDifference;
      if (left.ghostsDefeated !== right.ghostsDefeated) {
        return right.ghostsDefeated - left.ghostsDefeated;
      }
      if (left.lives !== right.lives) return right.lives - left.lives;
      return left.controlIndex - right.controlIndex;
    });
  }

  private resolveVote() {
    if (this.phase !== "voting") return;
    const counts = this.voteCounts();
    this.voteDecision =
      counts["change-game"] > this.humanVoterCount / 2 ? "change-game" : "next-level";
    this.phase = "decision";
    this.phaseElapsed = 0;
  }

  private voteCounts(): Record<MazePostMatchVote, number> {
    let nextLevel = 0;
    let changeGame = 0;
    for (const [playerId, choice] of this.votes) {
      const player = this.players.find((candidate) => candidate.id === playerId);
      if (!player || player.isBot) continue;
      if (choice === "next-level") nextLevel += 1;
      else changeGame += 1;
    }
    return { "next-level": nextLevel, "change-game": changeGame };
  }

  private snapshotPlayer(player: RuntimePlayer): MazePlayerSnapshot {
    const {
      desiredDirection: _desired,
      inputActive: _inputActive,
      axolotlHeartGranted: _axolotlHeartGranted,
      stopAtCenter: _stopAtCenter,
      abilityCooldownByCharacter: _cooldowns,
      botThinkSeconds: _botThink,
      botTarget: _target,
      botDifficulty: _difficulty,
      ...snapshot
    } = player;
    return {
      ...snapshot,
      abilityCooldowns: { ...player.abilityCooldownByCharacter },
      roster: [...player.roster],
      teleportTarget: player.teleportTarget ? { ...player.teleportTarget } : null,
      teleportTargetValid: player.teleportTarget
        ? this.isTeleportDestinationValid(player, player.teleportTarget)
        : false,
    };
  }
}

export { MAZE_PLAYER_KEYS, MAZE_TILE_SIZE, MAZE_COLUMNS };
