import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { playableCharacterSeeds } from "../data/characters";
import {
  createMatchId,
  settleMatchRewards,
  useMatchCurrencyRewards,
  walletIdForLocalSlot,
} from "../currency";
import { submitGlobalRecord } from "../leaderboard/api";
import { CurrencyRewardCard } from "../components/CurrencyRewardCard";
import { useArcadeAudio } from "../audio/ArcadeAudioProvider";
import { normalizePlayerName } from "../playerProfile";
import type { PlayableCharacterId } from "../types";
import {
  MAZE_CHARACTER_SWITCH_KEYS,
  MAZE_PLAYER_KEYS,
  LOCAL_PLAYER_CONTROLS,
  MAX_LOCAL_PLAYERS,
  MIN_LOCAL_PLAYERS,
  MAZE_TEAM_SIZE,
} from "./config";
import { MazeEngine } from "./engine";
import {
  MAZE_TUTORIAL_FOCUS_BY_STEP,
  MazeTutorialOverlay,
  type MazeTutorialFocus,
} from "./MazeTutorialOverlay";
import { getMazePower, MAZE_CHARACTER_IDS } from "./powers";
import { renderMaze } from "./render";
import type {
  MazeDirection,
  MazeMode,
  MazeParticipantConfig,
  MazePostMatchVote,
  MazeSnapshot,
} from "./types";

const DIRECTION_BINDINGS: Record<string, MazeDirection>[] = [
  { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" },
  { KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right" },
  { KeyI: "up", KeyK: "down", KeyJ: "left", KeyL: "right" },
  { KeyT: "up", KeyG: "down", KeyF: "left", KeyH: "right" },
];
const SOLO_WASD_BINDINGS: Record<string, MazeDirection> = {
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
};

function directionForKey(mode: MazeMode, index: number, code: string) {
  return (
    DIRECTION_BINDINGS[index]?.[code] ??
    ((mode === "solo" || mode === "bots") && index === 0 ? SOLO_WASD_BINDINGS[code] : undefined)
  );
}

function movementVectorForKeys(mode: MazeMode, index: number, codes: string[]) {
  const directions = codes
    .map((code) => directionForKey(mode, index, code))
    .filter((direction): direction is MazeDirection => direction !== undefined);
  const x = Number(directions.includes("right")) - Number(directions.includes("left"));
  const y = Number(directions.includes("down")) - Number(directions.includes("up"));
  const facing = [...directions]
    .reverse()
    .find((direction) => (direction === "left" || direction === "right" ? x !== 0 : y !== 0));
  return { x, y, facing };
}

function characterSlotForKey(index: number, code: string) {
  return MAZE_CHARACTER_SWITCH_KEYS[index]?.findIndex((key) => key === code) ?? -1;
}

function abilityKeyForControl(index: number) {
  return LOCAL_PLAYER_CONTROLS[index]?.ability ?? "—";
}

const DEFAULT_CHARACTER = playableCharacterSeeds[0]!.id;
const PANEL_STYLE =
  "pixel-panel border-2 border-arcade-panel-border bg-arcade-panel/90 shadow-[4px_4px_0_var(--color-arcade-shadow)]";

function characterAt(
  index: number,
  availableCharacters: typeof playableCharacterSeeds,
): PlayableCharacterId {
  return availableCharacters[index % Math.max(1, availableCharacters.length)]?.id ?? DEFAULT_CHARACTER;
}

function mazePowerSound(characterId: PlayableCharacterId) {
  switch (characterId) {
    case "white-fox-ice-mage":
      return "power-ice" as const;
    case "purple-rabbit-ninja":
      return "power-teleport" as const;
    case "swamp-frog-mage":
      return "power-swamp" as const;
    case "forge-raccoon-mage":
      return "power-forge" as const;
    case "time-owl-mage":
      return "power-time" as const;
    case "calm-capybara-mage":
      return "power-time" as const;
    case "axolotl-mage":
      return "power-time" as const;
  }
}

const MAZE_CHOOSER_CHARACTERS = MAZE_CHARACTER_IDS.map((characterId) =>
  playableCharacterSeeds.find((character) => character.id === characterId)!,
);

function makeParticipants(
  mode: MazeMode,
  playerName: string,
  selectedCharacterId: PlayableCharacterId | null,
  count: number,
  unlockedCharacterIds: PlayableCharacterId[],
): MazeParticipantConfig[] {
  const availableCharacters = playableCharacterSeeds.filter((character) =>
    unlockedCharacterIds.includes(character.id),
  );
  const humanCharacter =
    selectedCharacterId && unlockedCharacterIds.includes(selectedCharacterId)
      ? selectedCharacterId
      : (availableCharacters[0]?.id ?? DEFAULT_CHARACTER);
  if (mode === "solo") {
    return [
      {
        id: "maze-human-1",
        name: playerName || "JOGADOR 1",
        characterId: humanCharacter,
        controlIndex: 0,
      },
    ];
  }
  if (mode === "bots") {
    const bots = availableCharacters
      .filter((character) => character.id !== humanCharacter)
      .slice(0, 3)
      .map((character, index) => ({
        id: `maze-bot-${index + 1}`,
        name: ["GUARDIÃO LUNAR", "ESPÍRITO ERRANTE", "SENTINELA ESTELAR"][index]!,
        characterId: character.id,
        isBot: true,
        botDifficulty: (["casual", "balanced", "skilled"] as const)[index]!,
        controlIndex: index + 1,
      }));
    return [
      {
        id: "maze-human-1",
        name: playerName || "JOGADOR 1",
        characterId: humanCharacter,
        controlIndex: 0,
      },
      ...bots,
    ];
  }
  return Array.from({ length: count }, (_, index) => ({
    id: `maze-local-${index + 1}`,
    name: index === 0 ? playerName || "JOGADOR 1" : `JOGADOR ${index + 1}`,
    characterId: index === 0 ? humanCharacter : characterAt(index, availableCharacters),
    controlIndex: index,
  }));
}

function readBestScore(key: string) {
  if (typeof window === "undefined") return 0;
  try {
    return Number(window.localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function formatCooldown(seconds: number) {
  const remaining = Math.max(0, Math.ceil(seconds));
  return remaining > 0 ? `⚡ ${remaining}s` : "PRONTO";
}

function formatCooldownAccessible(seconds: number) {
  const remaining = Math.max(0, Math.ceil(seconds));
  return remaining > 0 ? `recarga ${remaining} segundos` : "PRONTO";
}

function actionButtonClass(accent = "border-arcade-violet text-arcade-ink") {
  return `border-2 ${accent} bg-arcade-sky/70 px-4 py-2 font-arcade text-[0.58rem] transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-arcade-cyan disabled:cursor-not-allowed disabled:opacity-45`;
}

function OverlayCard({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#090e2b]/75 p-3 backdrop-blur-[2px]">
      <div
        className={`${PANEL_STYLE} max-h-full w-full max-w-3xl overflow-y-auto rounded-sm p-4 text-center sm:p-6`}
      >
        {children}
      </div>
    </div>
  );
}

export function MazeScreen({
  mode,
  playerName,
  primaryWalletId,
  selectedCharacterId,
  unlockedCharacterIds,
  onBack,
  onChangeGame,
}: {
  mode: MazeMode;
  playerName: string;
  primaryWalletId: string;
  selectedCharacterId: PlayableCharacterId | null;
  unlockedCharacterIds: PlayableCharacterId[];
  onBack: () => void;
  onChangeGame: () => void;
}) {
  const { playSfx, setMusicIntensity } = useArcadeAudio();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<MazeEngine | null>(null);
  const resumeEngineLoopRef = useRef<(() => void) | null>(null);
  const pressedDirectionKeysRef = useRef(new Map<string, string[]>());
  const [playerCount, setPlayerCount] = useState(2);
  const [participants, setParticipants] = useState<MazeParticipantConfig[] | null>(() =>
    mode === "local"
      ? null
      : makeParticipants(mode, playerName, selectedCharacterId, 1, unlockedCharacterIds),
  );
  const [runId, setRunId] = useState(0);
  const [snapshot, setSnapshot] = useState<MazeSnapshot | null>(null);
  const audioRunIdRef = useRef(runId);
  const audioSnapshotRef = useRef<MazeSnapshot | null>(null);
  const seenPowerRuneItemsRef = useRef(new Set<string>());
  const completedLevelSoundRef = useRef<number | null>(null);
  const lastGhostWarningAtRef = useRef(0);
  const [spectatingIds, setSpectatingIds] = useState<string[]>([]);
  const [dismissedEliminationIds, setDismissedEliminationIds] = useState<string[]>([]);
  const changeGameHandled = useRef(false);
  const matchSessionId = useRef(createMatchId("maze"));
  const startLevelRef = useRef(1);
  const nextLevelRostersRef = useRef<Map<string, PlayableCharacterId[]> | null>(null);
  const nextLevelCooldownsRef = useRef<Map<
    string,
    MazeSnapshot["players"][number]["abilityCooldowns"]
  > | null>(null);
  const nextLevelPowerRunesRef = useRef<Map<string, number> | null>(null);
  const matchId = `${matchSessionId.current}:${runId}:${snapshot?.level ?? startLevelRef.current}`;
  const bestScoreKey = `spellbound-maze-best:${selectedCharacterId ?? DEFAULT_CHARACTER}`;
  const selectedCharacter = useMemo(
    () =>
      playableCharacterSeeds.find(
        (character) => character.id === (selectedCharacterId ?? DEFAULT_CHARACTER),
      )!,
    [selectedCharacterId],
  );
  const matchIsFinal =
    snapshot !== null &&
    ["level-clear", "results", "voting", "decision", "next-level", "change-game"].includes(
      snapshot.phase,
    );
  const finalizedRewardEntries =
    snapshot?.players.flatMap((entry) => {
      const isFinal = mode === "solo" ? snapshot.phase === "level-clear" : matchIsFinal;
      if (entry.isBot || !isFinal) return [];
      return [
        {
          walletId:
            entry.controlIndex === 0 ? primaryWalletId : walletIdForLocalSlot(entry.controlIndex),
          playerId: entry.id,
          playerName: entry.name,
          amount: entry.coinsCollected,
        },
      ];
    }) ?? [];
  const rewardReceipts = useMatchCurrencyRewards(matchId, finalizedRewardEntries, primaryWalletId);

  const tutorialStorageKey = useMemo(() => {
    const normalizedName = normalizePlayerName(playerName)?.normalizedName ?? "jogador";
    return `magisterium-arcade-maze-tutorial-v1:${encodeURIComponent(normalizedName)}`;
  }, [playerName]);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const tutorialOpenRef = useRef(false);
  const tutorialAutoOpenedRef = useRef(false);
  const clearHeldDirections = useCallback(() => {
    pressedDirectionKeysRef.current.clear();
    for (const participant of participants ?? []) {
      if (!participant.isBot) engineRef.current?.clearDirection(participant.id);
    }
  }, [participants]);
  const closeMazeTutorial = useCallback(() => {
    tutorialOpenRef.current = false;
    try {
      window.localStorage.setItem(tutorialStorageKey, "done");
    } catch {
      // The tutorial can still be dismissed when browser storage is unavailable.
    }
    setTutorialOpen(false);
  }, [tutorialStorageKey]);
  const openMazeTutorial = useCallback(() => {
    clearHeldDirections();
    tutorialOpenRef.current = true;
    setTutorialStep(0);
    setTutorialOpen(true);
  }, [clearHeldDirections]);

  useEffect(() => {
    if (!participants || tutorialAutoOpenedRef.current) return;
    tutorialAutoOpenedRef.current = true;
    let tutorialWasSeen = false;
    try {
      tutorialWasSeen = window.localStorage.getItem(tutorialStorageKey) === "done";
    } catch {
      // If storage is unavailable, show the tutorial for this visit.
    }
    if (!tutorialWasSeen) {
      tutorialOpenRef.current = true;
      setTutorialStep(0);
      setTutorialOpen(true);
    }
  }, [participants, tutorialStorageKey]);

  useEffect(() => {
    if (!participants) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const carriedRosters = nextLevelRostersRef.current;
    const carriedCooldowns = nextLevelCooldownsRef.current;
    const carriedPowerRunes = nextLevelPowerRunesRef.current;
    const engineParticipants = participants.map((participant) => {
      const roster = carriedRosters?.get(participant.id);
      return roster ? { ...participant, roster } : participant;
    });
    nextLevelRostersRef.current = null;
    nextLevelCooldownsRef.current = null;
    nextLevelPowerRunesRef.current = null;
    const engine = new MazeEngine({
      mode,
      participants: engineParticipants,
      bestScore: readBestScore(bestScoreKey),
      startLevel: startLevelRef.current,
      ...(carriedCooldowns ? { initialAbilityCooldowns: carriedCooldowns } : {}),
      ...(carriedPowerRunes ? { initialPowerRunes: carriedPowerRunes } : {}),
    });
    engineRef.current = engine;
    let animationFrame = 0;
    let lastFrame = performance.now();
    let lastHudUpdate = 0;
    let lastSnapshotPhase = engine.phase;
    let nextLevelTimer = 0;
    let nextLevelQueued = false;
    const frame = (time: number) => {
      const delta = Math.max(0, (time - lastFrame) / 1000);
      lastFrame = time;
      if (tutorialOpenRef.current) {
        animationFrame = window.requestAnimationFrame(frame);
        return;
      }
      engine.step(delta);
      let nextSnapshot = engine.snapshot();

      if (nextSnapshot.phase === "game-over") {
        const previousBest = readBestScore(bestScoreKey);
        const best = Math.max(previousBest, nextSnapshot.gameOverScore);
        try {
          window.localStorage.setItem(bestScoreKey, String(best));
        } catch {
          // The game remains playable when storage is unavailable.
        }
        if (best > previousBest) {
          void submitGlobalRecord("maze", best);
          playSfx("record");
        }
        engine.setBestScore(best);
        nextSnapshot = engine.snapshot();
      }

      renderMaze(context, nextSnapshot, time / 1000, mode !== "solo");
      if (time - lastHudUpdate >= 80 || nextSnapshot.phase !== lastSnapshotPhase) {
        setSnapshot(nextSnapshot);
        lastHudUpdate = time;
        lastSnapshotPhase = nextSnapshot.phase;
      }

      if (nextSnapshot.phase === "change-game") return;
      if (nextSnapshot.phase === "game-over") {
        animationFrame = 0;
        return;
      }
      if (nextSnapshot.phase === "next-level" && !nextLevelQueued) {
        nextLevelQueued = true;
        startLevelRef.current = nextSnapshot.level + 1;
        nextLevelRostersRef.current = new Map(
          nextSnapshot.players.map((player) => [player.id, [...player.roster]]),
        );
        nextLevelCooldownsRef.current = new Map(
          nextSnapshot.players.map((player) => [player.id, { ...player.abilityCooldowns }]),
        );
        nextLevelPowerRunesRef.current = new Map(
          nextSnapshot.players.map((player) => [player.id, player.powerRunes]),
        );
        nextLevelTimer = window.setTimeout(() => {
          setSnapshot(null);
          setSpectatingIds([]);
          setDismissedEliminationIds([]);
          changeGameHandled.current = false;
          setRunId((current) => current + 1);
        }, 700);
        return;
      }
      animationFrame = window.requestAnimationFrame(frame);
    };

    resumeEngineLoopRef.current = () => {
      if (animationFrame !== 0) return;
      lastFrame = performance.now();
      animationFrame = window.requestAnimationFrame(frame);
    };

    const initialSnapshot = engine.snapshot();
    setSnapshot(initialSnapshot);
    renderMaze(context, initialSnapshot, 0);
    animationFrame = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      if (nextLevelTimer) window.clearTimeout(nextLevelTimer);
      if (engineRef.current === engine) {
        engineRef.current = null;
        resumeEngineLoopRef.current = null;
      }
    };
  }, [bestScoreKey, mode, participants, playSfx, runId]);

  useEffect(() => {
    if (audioRunIdRef.current !== runId) {
      audioRunIdRef.current = runId;
      audioSnapshotRef.current = null;
      seenPowerRuneItemsRef.current.clear();
      completedLevelSoundRef.current = null;
      lastGhostWarningAtRef.current = 0;
      return;
    }
    if (!snapshot) return;

    const previous = audioSnapshotRef.current;
    if (previous) {
      if (
        previous.phase === "countdown" &&
        snapshot.phase === "countdown" &&
        previous.countdownLabel !== snapshot.countdownLabel
      ) {
        playSfx("countdown");
      }
      if (previous.phase === "countdown" && snapshot.phase === "playing") {
        playSfx("game-start");
      }

      const oldCollectedItems = new Set(
        previous.items.filter((item) => item.collectedBy !== null).map((item) => item.id),
      );
      let coinsCollected = 0;
      let ordinaryItemsCollected = 0;
      let powerRunesCollected = 0;
      for (const item of snapshot.items) {
        if (item.collectedBy === null || oldCollectedItems.has(item.id)) continue;
        const collector = snapshot.players.find((player) => player.id === item.collectedBy);
        if (!collector || collector.isBot) continue;
        if (item.kind === "coin") coinsCollected += 1;
        else if (item.kind === "power-rune") powerRunesCollected += 1;
        else ordinaryItemsCollected += 1;
      }
      for (let index = 0; index < Math.min(coinsCollected, 3); index += 1) {
        playSfx("coin", { volume: 0.8 + index * 0.08 });
      }
      if (ordinaryItemsCollected > 0) playSfx("collect", { volume: 0.82 });
      if (powerRunesCollected > 0) playSfx("rune", { volume: 1.05 });

      for (const item of snapshot.items) {
        if (item.kind !== "power-rune" || seenPowerRuneItemsRef.current.has(item.id)) continue;
        seenPowerRuneItemsRef.current.add(item.id);
        if (previous.items.some((oldItem) => oldItem.id !== item.id)) {
          playSfx("rune-spawn", { volume: 0.58 });
        }
      }

      const localPlayers = snapshot.players.filter((player) => !player.isBot);
      let lostLife = false;
      const activatedPowers: PlayableCharacterId[] = [];
      const revivedPlayerIds: string[] = [];
      let cooldownReady = false;
      for (const player of localPlayers) {
        const oldPlayer = previous.players.find((entry) => entry.id === player.id);
        if (!oldPlayer) continue;
        if (player.lives < oldPlayer.lives) lostLife = true;
        if (oldPlayer.status === "eliminated" && player.status === "active") {
          revivedPlayerIds.push(player.id);
        }
        if (player.powerRunes < oldPlayer.powerRunes) activatedPowers.push(player.characterId);
        if (player.score > oldPlayer.score) playSfx("score");
        for (const characterId of MAZE_CHARACTER_IDS) {
          if (
            (oldPlayer.abilityCooldowns[characterId] ?? 0) > 0 &&
            (player.abilityCooldowns[characterId] ?? 0) <= 0
          ) {
            cooldownReady = true;
          }
        }
      }
      if (revivedPlayerIds.length > 0) {
        const revivedIds = new Set(revivedPlayerIds);
        setDismissedEliminationIds((current) => current.filter((id) => !revivedIds.has(id)));
        setSpectatingIds((current) => current.filter((id) => !revivedIds.has(id)));
      }
      if (lostLife) {
        playSfx("hit", { volume: 0.55 });
        playSfx("life-lost");
      }
      if (activatedPowers.length > 0) playSfx(mazePowerSound(activatedPowers[0]!));
      if (cooldownReady) playSfx("cooldown-ready");
      if (!previous.exitOpen && snapshot.exitOpen) playSfx("exit-unlocked");

      if (snapshot.phase === "level-clear" && completedLevelSoundRef.current !== snapshot.level) {
        completedLevelSoundRef.current = snapshot.level;
        playSfx("level-clear");
      }
      if (snapshot.phase === "game-over" && previous.phase !== "game-over") {
        playSfx("game-over");
      }

      const primary = snapshot.players.find(
        (player) => !player.isBot && (player.controlIndex ?? 0) === 0,
      );
      if (primary && snapshot.phase === "playing") {
        const isThreatened = snapshot.ghosts.some(
          (ghost) =>
            ghost.frozenSeconds <= 0 &&
            ghost.timeStoppedSeconds <= 0 &&
            ghost.fleeingSeconds <= 0 &&
            ghost.stunnedSeconds <= 0 &&
            Math.hypot(ghost.x - primary.x, ghost.y - primary.y) <= 2.1,
        );
        const wasThreatened = previous.ghosts.some(
          (ghost) =>
            ghost.frozenSeconds <= 0 &&
            ghost.timeStoppedSeconds <= 0 &&
            ghost.fleeingSeconds <= 0 &&
            ghost.stunnedSeconds <= 0 &&
            Math.hypot(ghost.x - primary.x, ghost.y - primary.y) <= 2.1,
        );
        if (
          isThreatened &&
          !wasThreatened &&
          performance.now() - lastGhostWarningAtRef.current > 4500
        ) {
          lastGhostWarningAtRef.current = performance.now();
          playSfx("ghost-near", { volume: 0.55 });
        }
      }
    } else {
      if (snapshot.phase === "countdown") playSfx("countdown");
      if (snapshot.items.some((item) => item.kind === "power-rune" && item.collectedBy === null)) {
        playSfx("rune-spawn", { volume: 0.48 });
      }
      for (const item of snapshot.items) {
        if (item.kind === "power-rune") seenPowerRuneItemsRef.current.add(item.id);
      }
    }

    audioSnapshotRef.current = snapshot;
  }, [playSfx, runId, snapshot]);

  const mazeDangerNear =
    snapshot?.phase === "playing" &&
    snapshot.ghosts.some(
      (ghost) =>
        ghost.frozenSeconds <= 0 &&
        ghost.timeStoppedSeconds <= 0 &&
        ghost.fleeingSeconds <= 0 &&
        ghost.stunnedSeconds <= 0 &&
        snapshot.players.some(
          (player) =>
            !player.isBot &&
            (player.controlIndex ?? 0) === 0 &&
            Math.hypot(ghost.x - player.x, ghost.y - player.y) <= 2.1,
        ),
    );

  useEffect(() => {
    setMusicIntensity(mazeDangerNear ? 1.14 : 0.96);
  }, [mazeDangerNear, setMusicIntensity]);

  useEffect(() => () => setMusicIntensity(1), [setMusicIntensity]);

  useEffect(() => {
    if (snapshot?.phase !== "change-game" || changeGameHandled.current) return;
    changeGameHandled.current = true;
    onChangeGame();
  }, [onChangeGame, snapshot?.phase]);

  useEffect(() => {
    if (!participants) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (tutorialOpenRef.current) return;
      if (event.code === "Escape") {
        event.preventDefault();
        for (const participant of participants) {
          if (!participant.isBot && engineRef.current?.cancelTeleportTarget(participant.id)) {
            clearHeldDirections();
            if (engineRef.current) setSnapshot(engineRef.current.snapshot());
            return;
          }
        }
        clearHeldDirections();
        onBack();
        return;
      }
      for (const player of participants) {
        if (player.isBot) continue;
        const index = player.controlIndex ?? 0;
        const slot = characterSlotForKey(index, event.code);
        if (slot >= 0) {
          if (event.repeat) return;
          event.preventDefault();
          engineRef.current?.switchCharacter(player.id, slot);
          if (engineRef.current) setSnapshot(engineRef.current.snapshot());
          return;
        }
        const direction = directionForKey(mode, index, event.code);
        if (direction) {
          event.preventDefault();
          if (engineRef.current?.isTeleportAiming(player.id)) {
            engineRef.current.moveTeleportTarget(player.id, direction);
            if (engineRef.current) setSnapshot(engineRef.current.snapshot());
            return;
          }
          const heldKeys = pressedDirectionKeysRef.current.get(player.id) ?? [];
          if (event.repeat && heldKeys.includes(event.code)) return;
          const nextHeldKeys = [...heldKeys.filter((code) => code !== event.code), event.code];
          pressedDirectionKeysRef.current.set(player.id, nextHeldKeys);
          if (mode === "solo") {
            engineRef.current?.setDirection(player.id, direction);
          } else {
            const movement = movementVectorForKeys(mode, index, nextHeldKeys);
            engineRef.current?.setMovementVector(
              player.id,
              movement.x,
              movement.y,
              movement.facing ?? direction,
            );
          }
          return;
        }
        if (event.repeat) return;
        if (event.code === MAZE_PLAYER_KEYS[index]) {
          event.preventDefault();
          if (!engineRef.current?.useAbility(player.id)) playSfx("blocked");
          if (engineRef.current) setSnapshot(engineRef.current.snapshot());
          return;
        }
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      for (const player of participants) {
        if (player.isBot) continue;
        const heldKeys = pressedDirectionKeysRef.current.get(player.id);
        if (!heldKeys?.includes(event.code)) continue;
        event.preventDefault();
        const remainingKeys = heldKeys.filter((code) => code !== event.code);
        if (remainingKeys.length === 0) {
          pressedDirectionKeysRef.current.delete(player.id);
          engineRef.current?.clearDirection(player.id);
        } else {
          pressedDirectionKeysRef.current.set(player.id, remainingKeys);
          const lastKey = remainingKeys[remainingKeys.length - 1]!;
          const index = player.controlIndex ?? 0;
          const direction = directionForKey(mode, index, lastKey);
          if (direction && mode === "solo") {
            engineRef.current?.setDirection(player.id, direction);
          } else if (mode !== "solo") {
            const movement = movementVectorForKeys(mode, index, remainingKeys);
            engineRef.current?.setMovementVector(
              player.id,
              movement.x,
              movement.y,
              movement.facing ?? direction,
            );
          }
        }
        return;
      }
    };

    const onWindowBlur = () => clearHeldDirections();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") clearHeldDirections();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearHeldDirections();
    };
  }, [clearHeldDirections, mode, onBack, participants, playSfx, runId]);

  const startLocalMatch = () => {
    startLevelRef.current = 1;
    nextLevelRostersRef.current = null;
    nextLevelCooldownsRef.current = null;
    nextLevelPowerRunesRef.current = null;
    setParticipants(
      makeParticipants("local", playerName, selectedCharacterId, playerCount, unlockedCharacterIds),
    );
    setRunId((current) => current + 1);
    changeGameHandled.current = false;
  };

  const retryCurrentPhase = () => {
    const engine = engineRef.current;
    if (!engine || !engine.retryCurrentLevel()) return;
    pressedDirectionKeysRef.current.clear();
    nextLevelRostersRef.current = null;
    nextLevelCooldownsRef.current = null;
    nextLevelPowerRunesRef.current = null;
    setSpectatingIds([]);
    setDismissedEliminationIds([]);
    changeGameHandled.current = false;
    setSnapshot(engine.snapshot());
    resumeEngineLoopRef.current?.();
  };

  const advanceMazeLevel = () => {
    const engine = engineRef.current;
    if (!engine || snapshot?.phase !== "level-clear") return;
    settleMatchRewards(matchId, finalizedRewardEntries);
    if (engine.advanceToNextLevel()) {
      setSpectatingIds([]);
      setDismissedEliminationIds([]);
      changeGameHandled.current = false;
      setSnapshot(engine.snapshot());
    }
  };

  const castVote = (playerId: string, vote: MazePostMatchVote) => {
    engineRef.current?.vote(playerId, vote);
  };

  const activatePower = (playerId: string) => {
    if (!engineRef.current?.useAbility(playerId)) playSfx("blocked");
    if (engineRef.current) setSnapshot(engineRef.current.snapshot());
  };

  const switchPlayerCharacter = (playerId: string, slot: number) => {
    engineRef.current?.switchCharacter(playerId, slot);
    if (engineRef.current) setSnapshot(engineRef.current.snapshot());
  };

  const activateFirstPower = () => {
    const human = participants?.find((participant) => !participant.isBot);
    if (human) activatePower(human.id);
  };

  const toggleRosterCharacter = (playerId: string, characterId: PlayableCharacterId) => {
    const selecting = snapshot?.players.find((candidate) => candidate.id === playerId);
    if (!selecting || selecting.rosterConfirmed) return;
    const nextRoster = selecting.roster.includes(characterId)
      ? selecting.roster.filter((id) => id !== characterId)
      : selecting.roster.length < MAZE_TEAM_SIZE
        ? [...selecting.roster, characterId]
        : selecting.roster;
    engineRef.current?.setRosterSelection(playerId, nextRoster);
    if (engineRef.current) setSnapshot(engineRef.current.snapshot());
  };

  const confirmPlayerRoster = (playerId: string) => {
    engineRef.current?.confirmRoster(playerId);
    if (engineRef.current) setSnapshot(engineRef.current.snapshot());
  };

  const unresolvedElimination =
    snapshot?.players.find(
      (player) =>
        !player.isBot &&
        player.status === "eliminated" &&
        !spectatingIds.includes(player.id) &&
        !dismissedEliminationIds.includes(player.id),
    ) ?? null;

  if (!participants && mode === "local") {
    return (
      <main className="celestial-sky relative h-dvh min-h-0 overflow-hidden px-3 py-3 text-foreground sm:px-6 sm:py-5">
        <div className="pointer-events-none absolute inset-0 opacity-50">
          <div className="absolute left-[10%] top-[14%] h-2 w-2 bg-arcade-star shadow-[0_0_18px_var(--color-arcade-star)]" />
          <div className="absolute right-[12%] top-[28%] h-3 w-3 bg-arcade-cyan shadow-[0_0_22px_var(--color-arcade-cyan)]" />
          <div className="absolute bottom-[18%] left-[22%] h-2 w-2 bg-arcade-violet shadow-[0_0_18px_var(--color-arcade-violet)]" />
        </div>
        <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col">
          <header className="flex shrink-0 items-center justify-between gap-3">
            <div>
              <p className="font-arcade text-[0.52rem] text-arcade-violet">MAGISTERIUM ARCADE</p>
              <h1 className="mt-2 font-arcade text-xs leading-relaxed text-arcade-ink sm:text-sm">
                LABIRINTO MÁGICO
              </h1>
            </div>
            <button type="button" className={actionButtonClass()} onClick={onBack}>
              VOLTAR
            </button>
          </header>

          <section className="my-2 min-h-0 flex-1 overflow-y-auto py-3">
            <div className={`${PANEL_STYLE} rounded-sm p-4 sm:p-6`}>
              <div className="text-center">
                <p className="font-arcade text-[0.52rem] text-arcade-violet">MULTIPLAYER LOCAL</p>
                <h2 className="pixel-title mt-3 text-2xl leading-relaxed text-arcade-ink sm:text-4xl">
                  ESCOLHA SUA EQUIPE
                </h2>
                <p className="mx-auto mt-2 max-w-xl font-game text-base text-muted-foreground sm:text-lg">
                  De 2 a 4 participantes no mesmo dispositivo. Cada vaga tem movimento, magia e
                  troca de equipe próprios. Antes de cada nível, cada jogador escolhe três
                  personagens.
                </p>
              </div>

              <div
                className="mt-5 flex flex-wrap items-center justify-center gap-2"
                aria-label="Quantidade de jogadores"
              >
                {Array.from(
                  { length: MAX_LOCAL_PLAYERS - MIN_LOCAL_PLAYERS + 1 },
                  (_, offset) => offset + MIN_LOCAL_PLAYERS,
                ).map((count) => (
                  <button
                    key={count}
                    type="button"
                    aria-pressed={playerCount === count}
                    onClick={() => setPlayerCount(count)}
                    className={actionButtonClass(
                      playerCount === count
                        ? "border-arcade-cyan text-arcade-ink"
                        : "border-arcade-panel-border text-muted-foreground",
                    )}
                  >
                    {count} JOGADORES
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {Array.from({ length: playerCount }, (_, index) => (
                  <label
                    key={index}
                    className="border-2 border-arcade-panel-border bg-arcade-sky/30 p-3"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-arcade text-[0.52rem] text-arcade-ink">
                        {index === 0 ? playerName.toUpperCase() : `JOGADOR ${index + 1}`}
                      </span>
                      <span className="font-arcade text-right text-[0.4rem] leading-relaxed text-arcade-violet">
                        {LOCAL_PLAYER_CONTROLS[index]?.movement} · PODER{" "}
                        {LOCAL_PLAYER_CONTROLS[index]?.ability}
                        <br />
                        TROCA {LOCAL_PLAYER_CONTROLS[index]?.switch}
                      </span>
                    </span>
                    <p className="mt-3 font-game text-sm text-muted-foreground">
                      Escolha seu trio antes de entrar em cada labirinto.
                    </p>
                  </label>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={onBack}
                  className={actionButtonClass("border-arcade-panel-border text-arcade-ink")}
                >
                  VOLTAR
                </button>
                <button
                  type="button"
                  onClick={startLocalMatch}
                  className={actionButtonClass("border-arcade-violet text-arcade-ink")}
                >
                  COMEÇAR PARTIDA
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const player = snapshot?.players.find((candidate) => !candidate.isBot) ?? null;
  const selectingPlayer =
    snapshot?.phase === "character-select"
      ? (snapshot.players.find((candidate) => !candidate.isBot && !candidate.rosterConfirmed) ??
        null)
      : null;
  const selectedRoster = selectingPlayer?.roster ?? [];
  const power = player ? getMazePower(player.characterId) : getMazePower(selectedCharacter.id);
  const currentVoteIds = new Set(snapshot?.votedPlayerIds ?? []);
  const ghosts = snapshot?.ghosts ?? [];
  const globalTimeStopSeconds = snapshot?.globalTimeStopSeconds ?? 0;
  const timeNormalDisplaySeconds = snapshot?.timeNormalDisplaySeconds ?? 0;
  const timeStopReadout =
    globalTimeStopSeconds > 0
      ? `TEMPO PARADO · ${Math.ceil(globalTimeStopSeconds)}s`
      : timeNormalDisplaySeconds > 0
        ? "TEMPO NORMAL"
        : null;
  const controlReadouts = [
    {
      label: "GELO",
      count: ghosts.filter((ghost) => ghost.frozenSeconds > 0).length,
      seconds: Math.ceil(Math.max(0, ...ghosts.map((ghost) => ghost.frozenSeconds))),
    },
    {
      label: "ATORDOADOS",
      count: ghosts.filter((ghost) => ghost.stunnedSeconds > 0).length,
      seconds: Math.ceil(Math.max(0, ...ghosts.map((ghost) => ghost.stunnedSeconds))),
    },
  ].filter((effect) => effect.count > 0);
  const powerRuneWarnings =
    snapshot?.players.filter((entry) => !entry.isBot && entry.powerWarningSeconds > 0) ?? [];
  const blueGems = snapshot?.items.filter((item) => item.kind === "crystal") ?? [];
  const blueGemsCollected = blueGems.filter((item) => item.collectedBy !== null).length;
  const blueGemsTotal = blueGems.length;
  const allBlueGemsCollected = blueGemsTotal > 0 && blueGemsCollected === blueGemsTotal;
  const remainingObjectiveItems = Math.max(
    0,
    (snapshot?.collectiblesTotal ?? 0) - (snapshot?.collectiblesCollected ?? 0),
  );
  const tutorialFocus = MAZE_TUTORIAL_FOCUS_BY_STEP[tutorialStep] ?? "mission";
  const tutorialTargetClass = (target: MazeTutorialFocus) =>
    tutorialOpen && tutorialFocus === target
      ? "relative z-[40] rounded-sm ring-4 ring-arcade-cyan ring-offset-2 ring-offset-[#090e2b] shadow-[0_0_18px_rgba(96,226,255,0.8)] transition-all duration-200"
      : "";
  const tutorialPlayerCount =
    participants?.filter((participant) => !participant.isBot).length ?? playerCount;
  const blueGemProgress =
    blueGemsTotal > 0 ? Math.min(100, (blueGemsCollected / blueGemsTotal) * 100) : 0;
  const modeLabel =
    mode === "solo"
      ? "SOLO INFINITO"
      : mode === "bots"
        ? "MULTIPLAYER · BOTS"
        : "MULTIPLAYER LOCAL";

  return (
    <main className="celestial-sky relative h-dvh min-h-0 overflow-hidden p-2 text-foreground sm:p-3">
      <div className="relative z-10 mx-auto flex h-full max-w-[1500px] flex-col gap-2">
        <header className="flex shrink-0 items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-arcade text-[0.45rem] text-arcade-violet sm:text-[0.55rem]">
              MAGISTERIUM ARCADE · {modeLabel}
            </p>
            <h1 className="mt-1 truncate font-arcade text-[0.62rem] text-arcade-ink sm:text-sm">
              LABIRINTO MÁGICO
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Abrir novamente o tutorial do Labirinto Mágico"
              className={actionButtonClass("border-arcade-cyan text-arcade-ink")}
              onClick={openMazeTutorial}
            >
              ? AJUDA
            </button>
            <button
              type="button"
              className={actionButtonClass("border-arcade-panel-border text-arcade-ink")}
              onClick={onBack}
            >
              SAIR
            </button>
          </div>
        </header>

        <section
          aria-label="Resumo da partida"
          className="pixel-panel shrink-0 rounded-sm border-[3px] border-arcade-violet bg-[#e9f4ff]/95 px-3 py-2 shadow-[4px_5px_0_var(--color-arcade-shadow)] sm:px-5 sm:py-3"
        >
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-arcade-panel-border/70 pb-1.5">
            <p className="flex items-center gap-2 font-arcade text-[0.42rem] sm:text-[0.5rem]">
              <span className="text-arcade-violet">NÍVEL · CICLO</span>
              <span className="text-arcade-ink">
                {snapshot ? `${snapshot.level} · ${snapshot.cycle}` : "—"}
              </span>
            </p>
            <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-arcade text-[0.42rem] sm:text-[0.5rem]">
              <span className="shrink-0 text-arcade-violet">BIOMA</span>
              <span className="break-words text-arcade-ink">
                {snapshot?.biome.name ?? "PREPARANDO"}
              </span>
            </p>
          </div>
          <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.42fr)] sm:gap-3">
            <div
              data-maze-tutorial-target="mission"
              className={`min-w-0 rounded-sm border-2 border-arcade-cyan bg-arcade-cyan/10 p-2 sm:p-2.5 ${tutorialTargetClass("mission")}`}
            >
              <p className="font-arcade text-[0.42rem] text-arcade-violet sm:text-[0.5rem]">
                MISSÃO PRINCIPAL
              </p>
              <p className="mt-1 font-arcade text-[0.46rem] text-arcade-ink sm:text-[0.54rem]">
                💎 COLETE TODAS AS GEMAS AZUIS
              </p>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
                <span
                  data-maze-tutorial-target="gems"
                  className={`whitespace-nowrap font-arcade text-[0.67rem] text-arcade-ink sm:text-base ${tutorialTargetClass("gems")}`}
                  aria-label={`Gemas azuis coletadas: ${blueGemsCollected} de ${blueGemsTotal}`}
                >
                  💎 GEMAS AZUIS: {snapshot ? `${blueGemsCollected}/${blueGemsTotal}` : "—"}
                  {allBlueGemsCollected ? " ✓" : ""}
                </span>
                <span className="font-arcade text-[0.43rem] text-arcade-violet sm:text-[0.48rem]">
                  ◈ RUNAS COLETADAS:{" "}
                  {snapshot ? `${snapshot.runesActivated}/${snapshot.targetRunes}` : "—"}
                </span>
                <span
                  className="whitespace-nowrap font-arcade text-[0.43rem] text-arcade-gold sm:text-[0.48rem]"
                  title={`Moedas bônus coletadas nesta partida: ${player?.coinsCollected ?? 0}`}
                  aria-label={`Moedas bônus coletadas nesta partida: ${player?.coinsCollected ?? 0}`}
                >
                  🪙 BÔNUS: {player?.coinsCollected ?? 0}
                </span>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden border border-arcade-panel-border bg-[#101537]/15"
                role="progressbar"
                aria-label={`Progresso das gemas azuis: ${blueGemsCollected} de ${blueGemsTotal}`}
                aria-valuemin={0}
                aria-valuemax={Math.max(1, blueGemsTotal)}
                aria-valuenow={blueGemsCollected}
              >
                <div
                  className="h-full bg-arcade-cyan transition-[width] duration-300"
                  style={{ width: `${blueGemProgress}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1 sm:gap-2">
              <div className="rounded-sm border border-arcade-panel-border bg-arcade-sky/45 px-2 py-1.5">
                <p className="font-arcade text-[0.34rem] text-arcade-violet sm:text-[0.45rem]">
                  PONTOS
                </p>
                <p
                  className="mt-1 truncate font-arcade text-[0.65rem] text-arcade-ink sm:text-base"
                  aria-label={player ? `Pontos: ${player.score}` : "Pontos: aguardando"}
                  aria-live="polite"
                >
                  {snapshot && player ? player.score.toLocaleString("pt-BR") : "—"}
                </p>
              </div>
              <div className="rounded-sm border border-arcade-panel-border bg-arcade-sky/45 px-2 py-1.5">
                <p className="font-arcade text-[0.34rem] text-arcade-violet sm:text-[0.45rem]">
                  TEMPO
                </p>
                <p
                  className="mt-1 whitespace-nowrap font-arcade text-[0.65rem] text-arcade-ink sm:text-base"
                  aria-label={`Tempo de partida: ${formatTime(snapshot?.matchElapsedSeconds ?? 0)}`}
                  aria-live="polite"
                >
                  {snapshot ? formatTime(snapshot.matchElapsedSeconds) : "—"}
                </p>
              </div>
              <div className="rounded-sm border border-arcade-panel-border bg-arcade-sky/45 px-2 py-1.5">
                <p className="font-arcade text-[0.34rem] text-arcade-violet sm:text-[0.45rem]">
                  {mode === "solo" ? "VIDAS" : "ESPÍRITOS VENCIDOS"}
                </p>
                <p
                  className="mt-1 truncate font-arcade text-[0.65rem] text-arcade-ink sm:text-base"
                  aria-label={
                    player
                      ? mode === "solo"
                        ? `Vidas: ${player.lives}`
                        : `Espíritos vencidos: ${player.ghostsDefeated}`
                      : "Estado do jogador: aguardando"
                  }
                >
                  {snapshot && player
                    ? mode === "solo"
                      ? "♥".repeat(player.lives) || "0"
                      : String(player.ghostsDefeated)
                    : "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-2 grid min-w-0 gap-2 border-t border-arcade-panel-border/60 pt-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <p className="font-arcade text-[0.4rem] text-arcade-violet sm:text-[0.46rem]">
                ITENS PARA LIBERAR A SAÍDA:{" "}
                <strong className="text-arcade-ink">
                  {snapshot
                    ? `${snapshot.collectiblesCollected}/${snapshot.collectiblesTotal}`
                    : "—"}
                </strong>
              </p>
              <p
                data-maze-tutorial-target="exit"
                className={`mt-1 inline-flex flex-wrap items-center gap-1 border border-arcade-panel-border bg-arcade-sky/45 px-2 py-1 font-arcade text-[0.4rem] sm:text-[0.45rem] ${snapshot?.exitOpen ? "text-emerald-700" : "text-arcade-violet"} ${tutorialTargetClass("exit")}`}
                role="status"
                aria-live="polite"
              >
                {snapshot?.exitOpen
                  ? "✓ SAÍDA LIBERADA · CAMINHE ATÉ O PORTAL"
                  : snapshot
                    ? `🔒 SAÍDA BLOQUEADA · FALTAM ${remainingObjectiveItems} ${remainingObjectiveItems === 1 ? "ITEM" : "ITENS"}`
                    : "PREPARANDO A SAÍDA"}
              </p>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              {snapshot?.players
                .filter((entry) => !entry.isBot)
                .map((entry) => (
                  <span
                    key={entry.id}
                    className="whitespace-nowrap font-arcade text-[0.4rem] text-arcade-violet sm:text-[0.46rem]"
                    aria-label={`Runas de poder de ${entry.name}: ${entry.powerRunes}`}
                  >
                    🔮 {mode === "solo" ? "PODER" : `P${entry.controlIndex + 1} PODER`}:
                    <strong className="ml-1 text-arcade-ink">{entry.powerRunes}</strong>
                  </span>
                ))}
            </div>
          </div>
          {powerRuneWarnings.length > 0 && (
            <p
              className="mt-1 border-l-2 border-arcade-gold pl-2 font-arcade text-[0.4rem] leading-snug text-arcade-violet sm:text-[0.45rem]"
              role="status"
              aria-live="polite"
            >
              {powerRuneWarnings
                .map(
                  (entry) =>
                    `${mode === "solo" ? "" : `P${entry.controlIndex + 1}: `}ENCONTRE UMA RUNA PARA USAR SEU PODER!`,
                )
                .join(" · ")}
            </p>
          )}
          {(timeStopReadout || controlReadouts.length > 0) && (
            <p className="mt-1.5 break-words font-game text-[0.6rem] leading-snug text-arcade-violet sm:text-xs">
              {[
                ...(timeStopReadout ? [timeStopReadout] : []),
                ...controlReadouts.map(
                  (effect) => `${effect.label} ×${effect.count} · ${effect.seconds}s`,
                ),
              ].join(" · ")}
            </p>
          )}
        </section>

        <section className="grid min-h-0 flex-1 gap-2 md:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-sm border-4 border-arcade-panel-border bg-[#101537]/80 shadow-[6px_6px_0_var(--color-arcade-shadow)]">
            <canvas
              ref={canvasRef}
              width={800}
              height={544}
              className="block max-h-full max-w-full aspect-[25/17] h-auto w-auto pixelated"
              aria-label="Labirinto mágico em pixel-art"
            />

            {unresolvedElimination && snapshot?.phase === "playing" && (
              <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3">
                <section
                  role="status"
                  aria-live="polite"
                  className="pointer-events-auto w-full max-w-2xl border-2 border-arcade-pink bg-[#e9f4ff]/90 px-3 py-2 shadow-[3px_3px_0_var(--color-arcade-shadow)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-arcade text-[0.48rem] text-arcade-pink sm:text-[0.56rem]">
                        {unresolvedElimination.name} FOI ELIMINADO · A PARTIDA CONTINUA
                      </p>
                      <p className="mt-1 font-game text-xs text-muted-foreground">
                        Acompanhe o labirinto enquanto os outros jogadores continuam. Continuar
                        fecha este aviso e mantém você como espectador.
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        className={actionButtonClass("border-arcade-cyan text-arcade-ink")}
                        onClick={() =>
                          setSpectatingIds((current) => [...current, unresolvedElimination.id])
                        }
                      >
                        CONTINUAR COMO ESPECTADOR
                      </button>
                      <button
                        type="button"
                        className={actionButtonClass("border-arcade-panel-border text-arcade-ink")}
                        onClick={onBack}
                      >
                        SAIR DA SALA
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {player?.teleportTarget && snapshot?.phase === "playing" && (
              <div className="pointer-events-none absolute left-2 right-2 top-2 z-10 border border-arcade-violet bg-[#101537]/90 px-2 py-1 text-center font-arcade text-[0.38rem] text-arcade-ink sm:text-[0.45rem]">
                MIRA NINJA · SETAS/WASD AJUSTAM · PODER CONFIRMA · ESC CANCELA
              </div>
            )}

            {snapshot?.phase === "character-select" && selectingPlayer && (
              <OverlayCard>
                <p className="font-arcade text-[0.5rem] text-arcade-violet">
                  NÍVEL {snapshot.level} · JOGADOR {selectingPlayer.controlIndex + 1}
                </p>
                <h2 className="pixel-title mt-2 text-xl text-arcade-ink sm:text-3xl">
                  ESCOLHA SEUS 3 PERSONAGENS
                </h2>
                <p className="mt-2 font-game text-sm text-muted-foreground">
                  Selecione exatamente três. Só esse trio poderá ser usado neste labirinto.
                </p>
                <div className="mx-auto mt-4 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                  {MAZE_CHOOSER_CHARACTERS.filter((character) =>
                    unlockedCharacterIds.includes(character.id),
                  ).map((character) => {
                    const selectedIndex = selectedRoster.indexOf(character.id);
                    const characterPower = getMazePower(character.id);
                    const selectionFull = selectedRoster.length >= MAZE_TEAM_SIZE;
                    return (
                      <button
                        key={character.id}
                        type="button"
                        aria-pressed={selectedIndex >= 0}
                        disabled={selectedIndex < 0 && selectionFull}
                        onClick={() => toggleRosterCharacter(selectingPlayer.id, character.id)}
                        className={`relative flex min-h-28 flex-col items-center justify-center border-2 p-2 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-arcade-cyan disabled:cursor-not-allowed disabled:opacity-40 ${
                          selectedIndex >= 0
                            ? "border-arcade-cyan bg-arcade-cyan/20 shadow-[0_0_14px_rgba(96,226,255,0.55)]"
                            : "border-arcade-panel-border bg-arcade-sky/40 hover:bg-white/80"
                        }`}
                      >
                        {selectedIndex >= 0 && (
                          <span className="absolute right-1 top-1 font-arcade text-[0.4rem] text-arcade-violet">
                            SLOT {selectedIndex + 1}
                          </span>
                        )}
                        <img
                          src={character.sprite}
                          alt=""
                          className="h-12 w-12 object-contain [image-rendering:pixelated]"
                        />
                        <span className="mt-1 font-arcade text-[0.42rem] text-arcade-ink">
                          {character.shortName}
                        </span>
                        <span className="mt-1 text-center font-game text-[0.65rem] text-muted-foreground">
                          {characterPower.shortName}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {selectedRoster.includes("axolotl-mage") && (
                  <p className="mt-2 font-game text-xs text-arcade-violet">
                    ♥ O Axolote concede +1 vida nesta partida.
                  </p>
                )}
                <div className="mx-auto mt-3 flex max-w-3xl items-center justify-between gap-2 border border-arcade-panel-border bg-arcade-sky/35 px-3 py-2">
                  <div className="flex min-w-0 flex-wrap gap-2 font-game text-xs text-arcade-ink">
                    {Array.from({ length: MAZE_TEAM_SIZE }, (_, index) => {
                      const characterId = selectedRoster[index];
                      const character = playableCharacterSeeds.find(
                        (item) => item.id === characterId,
                      );
                      return (
                        <span key={index} className="border border-arcade-panel-border px-2 py-1">
                          {index + 1} · {character?.shortName ?? "VAGO"}
                        </span>
                      );
                    })}
                  </div>
                  <span className="shrink-0 font-arcade text-[0.48rem] text-arcade-violet">
                    {selectedRoster.length}/{MAZE_TEAM_SIZE}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={selectedRoster.length !== MAZE_TEAM_SIZE}
                  onClick={() => confirmPlayerRoster(selectingPlayer.id)}
                  className={`${actionButtonClass("border-arcade-violet text-arcade-ink")} mt-4 disabled:opacity-40`}
                >
                  CONFIRMAR E CONTINUAR
                </button>
              </OverlayCard>
            )}

            {snapshot?.phase === "countdown" && (
              <OverlayCard>
                <p className="font-arcade text-[0.55rem] text-arcade-violet">
                  {snapshot.biome.name}
                </p>
                <p className="pixel-title mt-4 text-6xl text-arcade-cyan sm:text-8xl">
                  {snapshot.countdownLabel}
                </p>
                <p className="mt-3 font-game text-lg text-muted-foreground">
                  Reúna todos os itens de objetivo; moedas são bônus. Runas de Poder carregam seu
                  próximo feitiço.
                </p>
              </OverlayCard>
            )}

            {snapshot?.phase === "level-clear" && (
              <OverlayCard>
                <p className="font-arcade text-xs text-arcade-cyan">✓ FASE CONCLUÍDA!</p>
                <h2 className="pixel-title mt-3 text-2xl text-arcade-ink sm:text-4xl">
                  FASE {snapshot.level}
                </h2>
                <div className="mx-auto mt-4 grid max-w-xl grid-cols-2 gap-2 text-left">
                  <Stat
                    label="PONTOS"
                    value={(snapshot.players[0]?.score ?? 0).toLocaleString("pt-BR")}
                  />
                  <Stat label="VIDAS" value={String(snapshot.players[0]?.lives ?? 0)} />
                  <Stat label="GEMAS AZUIS" value={`${blueGemsCollected}/${blueGemsTotal}`} />
                  <Stat
                    label="RUNAS COLETADAS"
                    value={`${snapshot.runesActivated}/${snapshot.targetRunes}`}
                  />
                </div>
                <CurrencyRewardCard receipts={rewardReceipts} />
                <p className="mt-3 font-game text-base text-muted-foreground">
                  Seu trio continua para o próximo mapa.
                </p>
                <div className="mt-5 flex justify-center">
                  <button
                    type="button"
                    className={actionButtonClass("border-arcade-cyan text-arcade-ink")}
                    onClick={advanceMazeLevel}
                  >
                    ➡️ PRÓXIMO NÍVEL
                  </button>
                </div>
              </OverlayCard>
            )}

            {snapshot?.phase === "game-over" && (
              <OverlayCard>
                <p className="font-arcade text-xs text-arcade-pink">💀 VOCÊ PERDEU</p>
                <h2 className="pixel-title mt-3 text-3xl text-arcade-ink sm:text-5xl">
                  FASE {snapshot.gameOverLevel || snapshot.level}
                </h2>
                <p className="mt-3 font-game text-base text-muted-foreground">
                  Tente novamente para completar esta fase!
                </p>
                {snapshot.gameOverReason && (
                  <p className="mt-2 font-game text-sm text-muted-foreground">
                    {snapshot.gameOverReason}
                  </p>
                )}
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    className={actionButtonClass("border-arcade-cyan text-arcade-ink")}
                    onClick={retryCurrentPhase}
                  >
                    🔄 REPETIR FASE
                  </button>
                  <button
                    type="button"
                    className={actionButtonClass("border-arcade-panel-border text-arcade-ink")}
                    onClick={onBack}
                  >
                    SAIR
                  </button>
                </div>
              </OverlayCard>
            )}

            {snapshot?.phase === "results" && (
              <OverlayCard>
                <p className="font-arcade text-[0.55rem] text-arcade-violet">PARTIDA ENCERRADA</p>
                <h2 className="pixel-title mt-2 text-2xl text-arcade-ink sm:text-4xl">
                  RESULTADO DA PARTIDA
                </h2>
                {snapshot.matchEndReason === "time-limit" && (
                  <p className="mt-2 font-arcade text-[0.48rem] text-arcade-pink">
                    TEMPO LIMITE · PLACAR FINAL DECIDE
                  </p>
                )}
                {snapshot.winnerId && (
                  <p className="mt-2 font-arcade text-[0.6rem] text-arcade-gold">
                    VENCEDOR:{" "}
                    {snapshot.players.find((candidate) => candidate.id === snapshot.winnerId)?.name}
                  </p>
                )}
                <div className="mx-auto mt-4 max-w-2xl overflow-hidden border-2 border-arcade-panel-border">
                  <div className="grid grid-cols-[2.3rem_minmax(0,1fr)_4.4rem_4rem_4rem] gap-1 bg-arcade-sky/80 px-2 py-2 text-left font-arcade text-[0.42rem] text-arcade-ink">
                    <span>#</span>
                    <span>JOGADOR</span>
                    <span>PONTOS</span>
                    <span>TEMPO</span>
                    <span>ESPÍRITOS</span>
                  </div>
                  {snapshot.ranking.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="grid grid-cols-[2.3rem_minmax(0,1fr)_4.4rem_4rem_4rem] gap-1 border-t border-arcade-panel-border/50 px-2 py-2 text-left font-game text-sm text-arcade-ink"
                    >
                      <span>{index + 1}º</span>
                      <span className="truncate">
                        {entry.name}
                        {entry.isBot ? " · CPU" : ""}
                      </span>
                      <span>{entry.score}</span>
                      <span>
                        {formatTime(entry.finishTimeSeconds ?? snapshot.matchElapsedSeconds)}
                      </span>
                      <span>{entry.ghostsDefeated}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 font-game text-sm text-muted-foreground">
                  Objetivos concluídos: {snapshot.crystalsCollected} cristais ·{" "}
                  {snapshot.runesActivated} runas · {snapshot.ghostsDefeated} espíritos
                  neutralizados.
                </p>
                <CurrencyRewardCard receipts={rewardReceipts} />
              </OverlayCard>
            )}

            {snapshot?.phase === "voting" && (
              <OverlayCard>
                <p className="font-arcade text-[0.55rem] text-arcade-violet">
                  VOTAÇÃO · {snapshot.votingSecondsRemaining}s
                </p>
                <h2 className="pixel-title mt-2 text-2xl text-arcade-ink sm:text-4xl">E AGORA?</h2>
                <p className="mt-2 font-game text-sm text-muted-foreground">
                  Cada pessoa vota uma vez. A maioria humana decide; empate avança para o próximo
                  nível.
                </p>
                <ol className="mx-auto mt-3 grid max-w-2xl gap-1 text-left sm:grid-cols-2">
                  {snapshot.ranking.map((entry, index) => (
                    <li
                      key={entry.id}
                      className="flex min-w-0 items-center gap-2 border border-arcade-panel-border bg-arcade-sky/45 px-2 py-1.5 font-game text-sm text-arcade-ink"
                    >
                      <span className="font-arcade text-[0.5rem] text-arcade-violet">
                        {index + 1}º
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {entry.name}
                        {entry.isBot ? " · CPU" : ""}
                      </span>
                      <span className="shrink-0 font-arcade text-[0.48rem]">
                        {entry.score.toLocaleString("pt-BR")} PTS
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 font-game text-xs text-muted-foreground">
                  Cristais {snapshot.crystalsCollected} · runas {snapshot.runesActivated} ·
                  espíritos {snapshot.ghostsDefeated}
                </p>
                <CurrencyRewardCard receipts={rewardReceipts} />
                <div className="mx-auto mt-4 grid max-w-2xl gap-3 sm:grid-cols-2">
                  {snapshot.players
                    .filter((candidate) => !candidate.isBot)
                    .map((voter) => {
                      const voted = currentVoteIds.has(voter.id);
                      return (
                        <div
                          key={voter.id}
                          className="border-2 border-arcade-panel-border bg-arcade-sky/35 p-3"
                        >
                          <p className="mb-2 font-arcade text-[0.48rem] text-arcade-ink">
                            {voter.name}
                            {voted ? " · VOTO REGISTRADO" : " · ESCOLHA"}
                          </p>
                          <div className="flex flex-wrap justify-center gap-2">
                            <button
                              type="button"
                              disabled={voted}
                              className={actionButtonClass("border-arcade-cyan text-arcade-ink")}
                              onClick={() => castVote(voter.id, "next-level")}
                            >
                              PRÓXIMO NÍVEL
                            </button>
                            <button
                              type="button"
                              disabled={voted}
                              className={actionButtonClass("border-arcade-violet text-arcade-ink")}
                              onClick={() => castVote(voter.id, "change-game")}
                            >
                              MUDAR DE JOGO
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
                <p className="mt-3 font-arcade text-[0.48rem] text-muted-foreground">
                  PRÓXIMO NÍVEL {snapshot.voteCounts["next-level"]} · MUDAR{" "}
                  {snapshot.voteCounts["change-game"]}
                </p>
              </OverlayCard>
            )}

            {snapshot?.phase === "decision" && (
              <OverlayCard>
                <p className="font-arcade text-[0.55rem] text-arcade-violet">
                  VOTO HUMANO CONCLUÍDO
                </p>
                <h2 className="pixel-title mt-3 text-3xl text-arcade-ink sm:text-5xl">
                  {snapshot.voteDecision === "change-game" ? "MUDAR DE JOGO" : "PRÓXIMO NÍVEL"}
                </h2>
                <p className="mt-3 font-game text-base text-muted-foreground">
                  {snapshot.voteDecision === "change-game"
                    ? "Voltando ao lobby celeste."
                    : `O nível ${snapshot.level + 1} começa em instantes para todos os jogadores.`}
                </p>
                <CurrencyRewardCard receipts={rewardReceipts} />
              </OverlayCard>
            )}
          </div>

          <aside className="hidden min-h-0 flex-col gap-2 overflow-hidden md:flex">
            <section className={`${PANEL_STYLE} min-h-0 flex-1 overflow-auto rounded-sm p-3`}>
              <p className="font-arcade text-[0.52rem] text-arcade-violet">
                JOGADORES · CLASSIFICAÇÃO
              </p>
              <div className="mt-3 space-y-2">
                {snapshot?.ranking.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={`border px-2 py-2 ${entry.status === "eliminated" ? "border-arcade-panel-border opacity-60" : "border-arcade-panel-border/70"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-game text-sm text-arcade-ink">
                        {index + 1}. {entry.name}
                      </span>
                      <span className="font-arcade text-[0.42rem] text-arcade-violet">
                        {entry.status === "eliminated"
                          ? "ELIMINADO"
                          : entry.status === "finished"
                            ? "CHEGOU"
                            : entry.isBot
                              ? "CPU"
                              : mode === "local" && entry.controlIndex > 0
                                ? `P${entry.controlIndex + 1}`
                                : "VOCÊ"}
                      </span>
                    </div>
                    <p className="mt-1 font-game text-xs text-muted-foreground">
                      {entry.score} pts · 🪙 {entry.coinsCollected} · ♥ {entry.lives} ·{" "}
                      {entry.ghostsDefeated} espíritos
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section
              className={`${PANEL_STYLE} max-h-[42%] min-h-0 shrink-0 overflow-y-auto rounded-sm p-2`}
            >
              <p className="font-arcade text-[0.47rem] text-arcade-violet">TRIOS · MAGIA</p>
              <div className="mt-2 space-y-1.5">
                {snapshot?.players.map((entry) => {
                  const currentPower = getMazePower(entry.characterId);
                  const abilityKey = abilityKeyForControl(entry.controlIndex);
                  const isAiming = entry.teleportTarget !== null;
                  const reviveTarget =
                    entry.characterId === "axolotl-mage"
                      ? snapshot.players
                          .filter(
                            (candidate) =>
                              candidate.id !== entry.id && candidate.status === "eliminated",
                          )
                          .sort(
                            (left, right) =>
                              (right.eliminationOrder ?? -1) - (left.eliminationOrder ?? -1),
                          )[0]
                      : undefined;
                  const powerBlocked =
                    snapshot.phase !== "playing" ||
                    entry.status !== "active" ||
                    (entry.abilityCooldownSeconds > 0 && entry.powerRunes > 0 && !isAiming) ||
                    (isAiming && !entry.teleportTargetValid) ||
                    (entry.characterId === "axolotl-mage" && !reviveTarget);
                  const cooldownProgress = Math.max(
                    0,
                    Math.min(
                      100,
                      100 * (1 - entry.abilityCooldownSeconds / currentPower.cooldownSeconds),
                    ),
                  );
                  return (
                    <div
                      key={entry.id}
                      className={`border p-1.5 ${entry.status === "eliminated" ? "border-arcade-panel-border opacity-50" : entry.isBot ? "border-arcade-panel-border/60" : "border-arcade-panel-border/80"}`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-1">
                        <span className="max-w-[10rem] truncate font-game text-[0.68rem] text-arcade-ink">
                          {entry.controlIndex === 0 && !entry.isBot
                            ? "VOCÊ"
                            : `P${entry.controlIndex + 1}`}{" "}
                          · {entry.name}
                        </span>
                        <span
                          className="shrink-0 font-arcade text-[0.34rem] text-arcade-cyan"
                          title={`Cargas de poder de ${entry.name}: ${entry.powerRunes}`}
                          aria-label={`Cargas de poder: ${entry.powerRunes}`}
                        >
                          🔮 {entry.powerRunes}
                        </span>
                        <span className="font-arcade text-[0.36rem] text-arcade-violet">
                          {entry.isBot
                            ? "CPU"
                            : entry.switchCooldownSeconds > 0
                              ? `TROCA ${entry.switchCooldownSeconds.toFixed(1)}s`
                              : "TROCAR"}
                        </span>
                      </div>
                      {entry.characterId === "axolotl-mage" && (
                        <p className="mb-1 font-game text-[0.62rem] text-arcade-violet">
                          {reviveTarget
                            ? `RESGATE DISPONÍVEL · ${reviveTarget.name}`
                            : "AGUARDANDO ALIADO ELIMINADO"}
                        </p>
                      )}
                      <div className="space-y-1">
                        {Array.from({ length: MAZE_TEAM_SIZE }, (_, slot) => {
                          const characterId = entry.roster[slot];
                          const character = playableCharacterSeeds.find(
                            (item) => item.id === characterId,
                          );
                          const characterPower = character ? getMazePower(character.id) : null;
                          const characterCooldown = character
                            ? (entry.abilityCooldowns[character.id] ?? 0)
                            : 0;
                          const isActive = slot === entry.activeCharacterSlot;
                          return (
                            <button
                              key={slot}
                              type="button"
                              title={
                                character
                                  ? `${slot + 1}. ${character.shortName} · ${characterPower?.name} · ${formatCooldown(characterCooldown)} · ${entry.isBot ? "CPU" : abilityKey}`
                                  : `Slot ${slot + 1} vazio`
                              }
                              aria-label={`${entry.name}: trocar para slot ${slot + 1}${character ? `, ${character.shortName}, poder ${characterPower?.name}, ${formatCooldownAccessible(characterCooldown)}` : " vazio"}`}
                              aria-pressed={isActive}
                              disabled={
                                entry.isBot ||
                                !character ||
                                snapshot.phase !== "playing" ||
                                entry.status !== "active" ||
                                isActive ||
                                entry.switchCooldownSeconds > 0
                              }
                              onClick={() => switchPlayerCharacter(entry.id, slot)}
                              className={`relative flex w-full min-w-0 items-center gap-1.5 border px-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcade-cyan disabled:cursor-not-allowed disabled:opacity-40 ${isActive ? "h-9 border-arcade-cyan bg-arcade-cyan/20 shadow-[0_0_10px_rgba(96,226,255,0.8)]" : "h-8 border-arcade-panel-border bg-arcade-sky/30 hover:bg-white/60"}`}
                            >
                              <span className="w-3 shrink-0 font-arcade text-[0.34rem] text-arcade-violet">
                                {slot + 1}
                              </span>
                              {character && (
                                <img
                                  src={character.sprite}
                                  alt=""
                                  className="h-6 w-6 shrink-0 object-contain [image-rendering:pixelated]"
                                />
                              )}
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-arcade text-[0.36rem] text-arcade-ink">
                                  {character?.shortName ?? "VAGO"}
                                </span>
                                {character && characterPower && (
                                  <span className="mt-0.5 flex items-center gap-1 font-arcade text-[0.3rem] text-arcade-violet">
                                    <span style={{ color: characterPower.accent }}>
                                      {characterPower.glyph}
                                    </span>
                                    <span>{entry.isBot ? "CPU" : abilityKey}</span>
                                    <span>{formatCooldown(characterCooldown)}</span>
                                  </span>
                                )}
                              </span>
                              {isActive && (
                                <span className="shrink-0 font-arcade text-[0.3rem] text-arcade-cyan">
                                  {entry.isBot ? "ATIVO" : "VOCÊ"}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {!entry.isBot && (
                        <button
                          type="button"
                          title={`${currentPower.name}: ${currentPower.description} · runas ${entry.powerRunes} · tecla ${abilityKey}`}
                          aria-label={`Usar ${currentPower.name} de ${entry.name} com ${abilityKey}; runas de poder ${entry.powerRunes}`}
                          disabled={powerBlocked}
                          onClick={() => activatePower(entry.id)}
                          className="mt-1 flex h-8 w-full items-center justify-between gap-2 border-2 border-arcade-violet bg-arcade-sky/60 px-2 font-arcade text-[0.38rem] text-arcade-ink disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <span className="flex min-w-0 items-center gap-1.5 truncate">
                            <span className="text-sm" style={{ color: currentPower.accent }}>
                              {currentPower.glyph}
                            </span>
                            <span className="truncate">{currentPower.shortName}</span>
                            <kbd className="shrink-0 border border-arcade-panel-border px-1 text-arcade-violet">
                              {abilityKey}
                            </kbd>
                          </span>
                          <span className="shrink-0">
                            {isAiming
                              ? "CONFIRMAR"
                              : entry.powerRunes <= 0
                                ? "SEM RUNA"
                                : entry.abilityCooldownSeconds > 0
                                  ? formatCooldown(entry.abilityCooldownSeconds)
                                  : entry.characterId === "axolotl-mage"
                                    ? reviveTarget
                                      ? "RESSUSCITAR"
                                      : "SEM ALVO"
                                    : formatCooldown(entry.abilityCooldownSeconds)}
                          </span>
                        </button>
                      )}
                      <div className="mt-1 h-1 overflow-hidden bg-arcade-panel-border/50">
                        <div
                          className="h-full transition-[width]"
                          style={{
                            width: `${cooldownProgress}%`,
                            backgroundColor: currentPower.accent,
                          }}
                        />
                      </div>
                      {entry.invulnerableSeconds > 0 && (
                        <p className="mt-1 font-arcade text-[0.34rem] text-arcade-cyan">
                          ESCUDO {Math.ceil(entry.invulnerableSeconds)}s
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section
              data-maze-tutorial-target="controls"
              className={`${PANEL_STYLE} shrink-0 rounded-sm p-3 ${tutorialTargetClass("controls")}`}
            >
              <p className="font-arcade text-[0.48rem] text-arcade-violet">CONTROLES</p>
              <div className="mt-2 space-y-1">
                {participants
                  ?.filter((participant) => !participant.isBot)
                  .map((participant) => {
                    const controlIndex = participant.controlIndex ?? 0;
                    const controls = LOCAL_PLAYER_CONTROLS[controlIndex];
                    const movement =
                      (mode === "solo" || mode === "bots") && controlIndex === 0
                        ? "SETAS / W A S D"
                        : controls?.movement;
                    return (
                      <p key={participant.id} className="font-game text-xs text-muted-foreground">
                        P{controlIndex + 1}: {movement} · poder {controls?.ability} · troca{" "}
                        {controls?.switch}
                      </p>
                    );
                  })}
              </div>
              <p className="mt-2 font-game text-xs text-muted-foreground">
                {snapshot?.biome.specialName}: {snapshot?.biome.specialRule}
              </p>
            </section>
          </aside>
        </section>

        <footer className="flex shrink-0 items-center justify-between gap-2 md:hidden">
          <span className="truncate font-game text-xs text-muted-foreground">
            {player
              ? player.teleportTarget
                ? `Mira ${player.teleportTargetValid ? "válida" : "bloqueada"} · setas · confirme com ${abilityKeyForControl(player.controlIndex)}`
                : player.characterId === "axolotl-mage"
                  ? `RESSURREIÇÃO · ${snapshot?.players.find((candidate) => candidate.id !== player.id && candidate.status === "eliminated")?.name ?? "AGUARDANDO ALIADO"} · 🔮 ${player.powerRunes}`
                  : `${power.shortName} · 🔮 ${player.powerRunes} · ${player.powerRunes <= 0 ? "SEM RUNA" : formatCooldown(player.abilityCooldownSeconds)} · tecla ${abilityKeyForControl(player.controlIndex)}`
              : "Preparando partida"}
          </span>
          <button
            type="button"
            disabled={
              !player ||
              snapshot?.phase !== "playing" ||
              (player.abilityCooldownSeconds > 0 &&
                player.powerRunes > 0 &&
                !player.teleportTarget) ||
              Boolean(player.teleportTarget && !player.teleportTargetValid) ||
              Boolean(
                player.characterId === "axolotl-mage" &&
                  !snapshot?.players.some(
                    (candidate) => candidate.id !== player.id && candidate.status === "eliminated",
                  ),
              )
            }
            className={`${actionButtonClass("border-arcade-violet text-arcade-ink")} px-2 py-2`}
            onClick={activateFirstPower}
          >
            {player?.teleportTarget
              ? `CONFIRMAR · ${abilityKeyForControl(player.controlIndex)}`
              : player?.characterId === "axolotl-mage"
                ? player.powerRunes <= 0
                  ? `SEM RUNA · ${abilityKeyForControl(player.controlIndex)}`
                  : player.abilityCooldownSeconds > 0
                    ? `RECARGA ${formatCooldown(player.abilityCooldownSeconds)}`
                    : snapshot?.players.some(
                          (candidate) => candidate.id !== player.id && candidate.status === "eliminated",
                        )
                      ? `RESSUSCITAR · ${abilityKeyForControl(player.controlIndex)}`
                      : "AGUARDANDO ALIADO"
              : player && player.powerRunes <= 0
                ? `SEM RUNA · ${abilityKeyForControl(player.controlIndex)}`
                : `USAR PODER · ${abilityKeyForControl(player?.controlIndex ?? 0)}`}
          </button>
          {spectatingIds.length > 0 && (
            <span className="font-arcade text-[0.42rem] text-arcade-cyan">ESPECTADOR</span>
          )}
        </footer>
        {tutorialOpen && (
          <MazeTutorialOverlay
            step={tutorialStep}
            mode={mode}
            playerCount={tutorialPlayerCount}
            blueGemsTotal={blueGemsTotal}
            onPrevious={() => setTutorialStep((current) => Math.max(0, current - 1))}
            onNext={() =>
              setTutorialStep((current) =>
                Math.min(MAZE_TUTORIAL_FOCUS_BY_STEP.length - 1, current + 1),
              )
            }
            onSkip={closeMazeTutorial}
            onComplete={closeMazeTutorial}
          />
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-arcade-panel-border bg-arcade-sky/35 px-3 py-2">
      <p className="font-arcade text-[0.42rem] text-arcade-violet">{label}</p>
      <p className="mt-1 font-arcade text-[0.62rem] text-arcade-ink">{value}</p>
    </div>
  );
}
