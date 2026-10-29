import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from "react";

import { Button } from "@/components/ui/button";

import { CurrencyRewardCard } from "../components/CurrencyRewardCard";
import { PixelSceneDecor } from "../components/PixelSceneDecor";
import { createMatchId, useMatchCurrencyRewards, walletIdForLocalSlot } from "../currency";
import { submitGlobalRecord } from "../leaderboard/api";
import { useArcadeAudio } from "../audio/ArcadeAudioProvider";
import { playableCharacterSeeds } from "../data/characters";
import { GameplaySprite } from "../gameplay/sprites/GameplaySprite";
import type { PlayableCharacterId } from "../types";
import { getSkyFlapCoinReward } from "./engine";
import { SKY_FLAP_CONFIG as C } from "./config";
import type { SkyFlapBotDifficulty } from "./bots";
import {
  MAX_SKY_FLAP_PLAYERS,
  MIN_SKY_FLAP_PLAYERS,
  SKY_FLAP_VOTE_SECONDS,
  SKY_FLAP_PLAYER_CONTROLS,
  SkyFlapMultiplayerEngine,
  type SkyFlapMatchPlayer,
  type SkyFlapMultiplayerSnapshot,
  type SkyFlapPostMatchVote,
  type SkyFlapParticipantConfig,
} from "./multiplayerEngine";
import { drawSkyFlapPlayerEffects, drawSkyFlapWorld } from "./render";
import { PlayerGameOverBurst, PlayerMagicCloud, type GameOverBurstState } from "./SkyFlapScreen";

const PLAYER_KEYS = ["Space", "Enter", "KeyW", "ArrowUp"] as const;

interface SetupParticipant {
  id: string;
  name: string;
  characterId: PlayableCharacterId;
  isBot: boolean;
  botDifficulty?: SkyFlapBotDifficulty;
}

interface MultiplayerBurst extends GameOverBurstState {
  playerId: string;
  characterId: PlayableCharacterId;
}

interface SkyFlapMultiplayerScreenProps {
  selectedCharacterId: PlayableCharacterId | null;
  primaryWalletId: string;
  playerName?: string;
  mode?: "local" | "bots";
  onBack: () => void;
  onChangeGame: () => void;
}

function makeInitialParticipants(
  selectedCharacterId: PlayableCharacterId | null,
  mode: "local" | "bots",
  playerName: string,
): SetupParticipant[] {
  if (mode === "bots") {
    return [
      {
        id: "player-1",
        name: playerName.trim() || "JOGADOR",
        characterId: selectedCharacterId ?? playableCharacterSeeds[0]!.id,
        isBot: false,
      },
      {
        id: "bot-1",
        name: "BOT FÁCIL",
        characterId: playableCharacterSeeds[1]!.id,
        isBot: true,
        botDifficulty: "casual",
      },
      {
        id: "bot-2",
        name: "BOT MÉDIO",
        characterId: playableCharacterSeeds[2]!.id,
        isBot: true,
        botDifficulty: "balanced",
      },
      {
        id: "bot-3",
        name: "BOT HÁBIL",
        characterId: playableCharacterSeeds[3]!.id,
        isBot: true,
        botDifficulty: "skilled",
      },
    ];
  }

  return [
    {
      id: "player-1",
      name: playerName.trim() || "JOGADOR 1",
      characterId: selectedCharacterId ?? playableCharacterSeeds[0]!.id,
      isBot: false,
    },
    {
      id: "player-2",
      name: "JOGADOR 2",
      characterId: playableCharacterSeeds[1]!.id,
      isBot: false,
    },
  ];
}

function playerKeyLabel(index: number) {
  return SKY_FLAP_PLAYER_CONTROLS[index] ?? "";
}

function playerSnapshotForRender(player: SkyFlapMatchPlayer, snapshot: SkyFlapMultiplayerSnapshot) {
  return {
    phase: player.phase === "eliminated" ? ("gameover" as const) : player.phase,
    playerX: player.playerX,
    playerY: player.playerY,
    playerVelocityY: player.playerVelocityY,
    score: player.score,
    speedMultiplier: snapshot.speedMultiplier,
    bestScore: player.bestScore,
    scrollDistance: snapshot.scrollDistance,
    obstacles: snapshot.obstacles,
  };
}

function PlayerSetupCard({
  participant,
  index,
  onNameChange,
  onCharacterChange,
}: {
  participant: SetupParticipant;
  index: number;
  onNameChange: (id: string, value: string) => void;
  onCharacterChange: (id: string, characterId: PlayableCharacterId) => void;
}) {
  return (
    <article className="pixel-panel rounded-sm border-2 border-arcade-panel-border p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-arcade text-[0.62rem] text-arcade-violet sm:text-xs">
          {participant.isBot ? `BOT ${index}` : `JOGADOR ${index + 1}`}
        </h2>
        <span className="border border-arcade-cyan/70 bg-arcade-sky/45 px-2 py-1 font-arcade text-[0.48rem] text-arcade-ink sm:text-[0.55rem]">
          {participant.isBot
            ? `IA · ${(participant.botDifficulty ?? "balanced").toUpperCase()}`
            : playerKeyLabel(index)}
        </span>
      </div>

      <label className="block font-arcade text-[0.48rem] text-muted-foreground sm:text-[0.55rem]">
        NOME DO JOGADOR
        <input
          type="text"
          value={participant.name}
          maxLength={18}
          autoComplete="off"
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onNameChange(participant.id, event.target.value)
          }
          className="mt-2 w-full border-2 border-arcade-panel-border bg-arcade-sky/55 px-3 py-2 font-game text-lg text-arcade-ink outline-none focus-visible:ring-2 focus-visible:ring-arcade-cyan"
          aria-label={`Nome do jogador ${index + 1}`}
        />
      </label>

      <p className="mb-2 mt-4 font-arcade text-[0.48rem] text-muted-foreground sm:text-[0.55rem]">
        ESCOLHA SEU PERSONAGEM
      </p>
      <div
        className="grid grid-cols-5 gap-1.5"
        role="group"
        aria-label={`Personagem do jogador ${index + 1}`}
      >
        {playableCharacterSeeds.map((character) => {
          const selected = character.id === participant.characterId;
          return (
            <button
              key={character.id}
              type="button"
              onClick={() => onCharacterChange(participant.id, character.id)}
              aria-label={character.name}
              aria-pressed={selected}
              className={`flex min-w-0 flex-col items-center gap-1 border-2 px-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcade-cyan ${
                selected
                  ? "border-arcade-cyan bg-arcade-sky/75"
                  : "border-arcade-panel-border bg-arcade-panel/60 hover:bg-arcade-sky/50"
              }`}
            >
              <img
                src={character.sprite}
                alt=""
                aria-hidden="true"
                width={34}
                height={34}
                className="h-8 w-8 object-contain [image-rendering:pixelated]"
              />
              <span className="font-arcade text-[0.36rem] leading-tight text-arcade-ink sm:text-[0.43rem]">
                {character.shortName}
              </span>
            </button>
          );
        })}
      </div>
    </article>
  );
}

function PlayerHudRow({ player, index }: { player: SkyFlapMatchPlayer; index: number }) {
  const character = playableCharacterSeeds.find((entry) => entry.id === player.characterId);
  const eliminated = player.phase === "eliminated";
  const isLocalPlayer = player.id === "player-1" && !player.isBot;
  return (
    <div
      className={`grid grid-cols-[1.7rem_minmax(0,1fr)_auto] items-center gap-1.5 border-b border-arcade-panel-border/50 px-2 py-1 last:border-0 ${isLocalPlayer ? "bg-arcade-cyan/20 ring-1 ring-inset ring-arcade-gold/80" : "opacity-75"} ${eliminated ? "opacity-55" : ""}`}
      aria-label={`${player.name}, ${character?.shortName ?? "personagem"}, ${eliminated ? "eliminado" : `${player.score} pontos`}`}
    >
      <img
        src={character?.sprite}
        alt=""
        aria-hidden="true"
        width={28}
        height={28}
        className="h-7 w-7 object-contain [image-rendering:pixelated]"
      />
      <span className="min-w-0 truncate font-arcade text-[0.42rem] text-arcade-ink sm:text-[0.5rem]">
        {player.name.toLocaleUpperCase()}{" "}
        <span className="text-arcade-violet">
          {player.isBot ? `BOT ${index}` : isLocalPlayer ? "VOCÊ" : `P${index + 1}`}
        </span>
      </span>
      <span className="whitespace-nowrap font-arcade text-[0.42rem] text-arcade-cyan sm:text-[0.5rem]">
        {eliminated
          ? "ELIMINADO"
          : `${player.score} PTS · 🪙 ${getSkyFlapCoinReward(player.score)}`}
      </span>
    </div>
  );
}

export function SkyFlapMultiplayerScreen({
  selectedCharacterId,
  primaryWalletId,
  playerName = "JOGADOR",
  mode = "local",
  onBack,
  onChangeGame,
}: SkyFlapMultiplayerScreenProps) {
  const { playSfx, setMusicIntensity } = useArcadeAudio();
  const [stage, setStage] = useState<"setup" | "match">("setup");
  const [participants, setParticipants] = useState<SetupParticipant[]>(() =>
    makeInitialParticipants(selectedCharacterId, mode, playerName),
  );
  const [snapshot, setSnapshot] = useState<SkyFlapMultiplayerSnapshot | null>(null);
  const previousAudioSnapshotRef = useRef<SkyFlapMultiplayerSnapshot | null>(null);
  const audioEndPlayedRef = useRef(false);
  const [matchId, setMatchId] = useState(() => createMatchId("sky-flap"));
  const submittedGlobalRecordRef = useRef<string | null>(null);
  const [bursts, setBursts] = useState<MultiplayerBurst[]>([]);
  const [isSpectating, setIsSpectating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerElementsRef = useRef(new Map<string, HTMLDivElement>());
  const spriteElementsRef = useRef(new Map<string, HTMLDivElement>());
  const engineRef = useRef<SkyFlapMultiplayerEngine | null>(null);
  const previousScoresRef = useRef<Record<string, number>>({});
  const scoreEffectStartedAtRef = useRef<Record<string, number>>({});
  const entryStartedAtRef = useRef<number | null>(null);
  const matchIsFinal =
    snapshot !== null &&
    ["results", "voting", "decision", "rematch", "change-game"].includes(snapshot.phase);
  const finalizedRewardEntries =
    snapshot?.players.flatMap((player) => {
      if (player.isBot || (player.phase !== "eliminated" && !matchIsFinal)) return [];
      const humanSlot = snapshot.players
        .filter((candidate) => !candidate.isBot)
        .findIndex((c) => c.id === player.id);
      return [
        {
          walletId: humanSlot === 0 ? primaryWalletId : walletIdForLocalSlot(humanSlot),
          playerId: player.id,
          playerName: player.name,
          amount: getSkyFlapCoinReward(player.score),
        },
      ];
    }) ?? [];
  const rewardReceipts = useMatchCurrencyRewards(matchId, finalizedRewardEntries, primaryWalletId);

  useEffect(() => {
    if (!matchIsFinal || !snapshot) return;
    const primaryPlayer = snapshot.players.find(
      (player) => player.id === "player-1" && !player.isBot,
    );
    if (!primaryPlayer || primaryPlayer.score <= 0) return;
    const submissionKey = `${matchId}:${primaryPlayer.score}`;
    if (submittedGlobalRecordRef.current === submissionKey) return;
    submittedGlobalRecordRef.current = submissionKey;
    void submitGlobalRecord("sky-flap", primaryPlayer.score);
  }, [matchId, matchIsFinal, snapshot]);

  useEffect(() => {
    if (!snapshot) return;
    const previous = previousAudioSnapshotRef.current;
    if (!previous) {
      if (snapshot.phase === "countdown") playSfx("countdown");
      previousAudioSnapshotRef.current = snapshot;
      return;
    }

    if (
      snapshot.phase === "countdown" &&
      previous.phase === "countdown" &&
      snapshot.countdownLabel !== previous.countdownLabel
    ) {
      playSfx("countdown");
    }
    if (previous.phase === "countdown" && snapshot.phase === "playing") {
      playSfx("game-start");
    }

    for (const player of snapshot.players) {
      if (player.isBot) continue;
      const oldPlayer = previous.players.find((entry) => entry.id === player.id);
      if (!oldPlayer || player.score <= oldPlayer.score) continue;
      if (player.bestScore > oldPlayer.bestScore) playSfx("record");
      else playSfx("score");
    }

    const primary = snapshot.players.find((player) => player.id === "player-1" && !player.isBot);
    const oldPrimary = previous.players.find((player) => player.id === "player-1" && !player.isBot);
    if (
      !audioEndPlayedRef.current &&
      primary?.phase === "eliminated" &&
      oldPrimary?.phase !== "eliminated"
    ) {
      audioEndPlayedRef.current = true;
      playSfx("game-over");
    } else if (
      !audioEndPlayedRef.current &&
      previous.phase === "playing" &&
      snapshot.phase === "results" &&
      primary
    ) {
      audioEndPlayedRef.current = true;
      playSfx(snapshot.winnerId === primary.id ? "win" : "game-over");
    }

    previousAudioSnapshotRef.current = snapshot;
  }, [playSfx, snapshot]);

  const flapMusicIntensity = Math.min(
    1.16,
    0.9 + Math.floor(Math.max(0, (snapshot?.speedMultiplier ?? 1) - 1) * 10) * 0.035,
  );
  useEffect(() => {
    setMusicIntensity(flapMusicIntensity);
  }, [flapMusicIntensity, setMusicIntensity]);
  useEffect(() => () => setMusicIntensity(1), [setMusicIntensity]);

  const updateName = (id: string, name: string) => {
    setParticipants((current) =>
      current.map((player) => (player.id === id ? { ...player, name } : player)),
    );
  };

  const updateCharacter = (id: string, characterId: PlayableCharacterId) => {
    setParticipants((current) =>
      current.map((player) => (player.id === id ? { ...player, characterId } : player)),
    );
  };

  const addParticipant = () => {
    setParticipants((current) => {
      if (current.length >= MAX_SKY_FLAP_PLAYERS) return current;
      const index = current.length;
      const character = playableCharacterSeeds[index % playableCharacterSeeds.length]!;
      const isBot = mode === "bots";
      const difficulty: SkyFlapBotDifficulty =
        index % 3 === 1 ? "casual" : index % 3 === 2 ? "balanced" : "skilled";
      return [
        ...current,
        {
          id: isBot ? `bot-${index}` : `player-${index + 1}`,
          name: isBot ? `BOT ${difficulty.toUpperCase()}` : `JOGADOR ${index + 1}`,
          characterId: character.id,
          isBot,
          ...(isBot ? { botDifficulty: difficulty } : {}),
        },
      ];
    });
  };

  const removeParticipant = () => {
    setParticipants((current) =>
      current.length <= MIN_SKY_FLAP_PLAYERS ? current : current.slice(0, -1),
    );
  };

  const startMatch = () => {
    const configuredPlayers: SkyFlapParticipantConfig[] = participants.map((player, index) => ({
      id: player.id,
      name: player.name.trim() || `JOGADOR ${index + 1}`,
      characterId: player.characterId,
      isBot: player.isBot,
      ...(player.botDifficulty ? { botDifficulty: player.botDifficulty } : {}),
    }));
    const engine = new SkyFlapMultiplayerEngine(configuredPlayers);
    engineRef.current = engine;
    const firstSnapshot = engine.snapshot();
    previousScoresRef.current = Object.fromEntries(
      firstSnapshot.players.map((player) => [player.id, player.score]),
    );
    scoreEffectStartedAtRef.current = {};
    entryStartedAtRef.current = null;
    setIsSpectating(false);
    previousAudioSnapshotRef.current = null;
    audioEndPlayedRef.current = false;
    setMatchId(createMatchId("sky-flap"));
    setSnapshot(firstSnapshot);
    setBursts([]);
    setStage("match");
  };

  const castVote = (playerId: string, choice: SkyFlapPostMatchVote) => {
    const engine = engineRef.current;
    if (engine?.vote(playerId, choice)) setSnapshot(engine.snapshot());
  };

  useEffect(() => {
    if (snapshot?.phase === "rematch") {
      engineRef.current = null;
      setSnapshot(null);
      setBursts([]);
      setIsSpectating(false);
      setStage("setup");
    } else if (snapshot?.phase === "change-game") {
      onChangeGame();
    }
  }, [onChangeGame, snapshot?.phase]);

  useEffect(() => {
    if (stage !== "match") return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !engineRef.current) return;

    let frame = 0;
    let previousTime = performance.now();
    let previousHudKey = "";

    const loop = (now: number) => {
      const activeEngine = engineRef.current;
      if (!activeEngine) return;
      const deltaSeconds = Math.min(0.05, Math.max(0, (now - previousTime) / 1000));
      previousTime = now;
      const events = activeEngine.step(deltaSeconds);
      const current = activeEngine.snapshot();

      if (current.phase === "playing" && entryStartedAtRef.current === null) {
        entryStartedAtRef.current = now;
      }
      const entryStartedAt = entryStartedAtRef.current;
      const entryProgress =
        entryStartedAt === null ? 1 : Math.min(1, (now - entryStartedAt) / C.entryEffectDurationMs);

      for (const playerId of events.scoredPlayerIds) {
        scoreEffectStartedAtRef.current[playerId] = now;
      }
      if (events.eliminatedPlayerIds.length > 0) {
        const newBursts = events.eliminatedPlayerIds.flatMap((playerId, index) => {
          const player = current.players.find((candidate) => candidate.id === playerId);
          if (!player) return [];
          return [
            {
              playerId,
              characterId: player.characterId,
              x: player.playerX,
              y: player.playerY,
              id: now + index,
            },
          ];
        });
        setBursts((existing) => [...existing, ...newBursts]);
      }

      const worldSnapshot = {
        phase:
          current.phase === "playing"
            ? ("playing" as const)
            : current.phase === "countdown"
              ? ("ready" as const)
              : ("gameover" as const),
        speedMultiplier: current.speedMultiplier,
        scrollDistance: current.scrollDistance,
        obstacles: current.obstacles,
      };
      drawSkyFlapWorld(context, worldSnapshot, now / 1000);

      for (const player of current.players) {
        const element = playerElementsRef.current.get(player.id);
        if (element) {
          element.style.left = `${(player.playerX / C.width) * 100}%`;
          element.style.top = `${(player.playerY / C.height) * 100}%`;
          element.style.opacity = player.id === "player-1" ? "1" : "0.72";
        }
        const spriteElement = spriteElementsRef.current.get(player.id);
        if (spriteElement) {
          const angle = Math.max(-20, Math.min(34, player.playerVelocityY * 0.045));
          spriteElement.style.transform = `rotate(${angle}deg)`;
        }

        const scoreStartedAt = scoreEffectStartedAtRef.current[player.id];
        const scoreProgress =
          scoreStartedAt === undefined
            ? 1
            : Math.min(1, (now - scoreStartedAt) / C.scoreEffectDurationMs);
        drawSkyFlapPlayerEffects(context, playerSnapshotForRender(player, current), now / 1000, {
          entryProgress,
          scoreProgress,
        });
      }

      const hudKey = [
        current.phase,
        current.countdownLabel,
        current.winnerId,
        current.speedMultiplier.toFixed(3),
        current.votingSecondsRemaining,
        current.decisionSecondsRemaining.toFixed(2),
        current.voteCounts.rematch,
        current.voteCounts["change-game"],
        current.voteDecision,
        ...current.players.flatMap((player) => [
          player.id,
          player.name,
          player.phase,
          player.score,
          current.votesByPlayer[player.id],
        ]),
      ].join("|");
      if (hudKey !== previousHudKey) {
        previousHudKey = hudKey;
        setSnapshot(current);
      }
      frame = window.requestAnimationFrame(loop);
    };

    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [stage]);

  useEffect(() => {
    if (stage !== "match") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const index = PLAYER_KEYS.indexOf(event.code as (typeof PLAYER_KEYS)[number]);
      if (index < 0) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("button, input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      const engine = engineRef.current;
      if (!engine || engine.phase !== "playing") return;
      const playerId = `player-${index + 1}`;
      if (isSpectating && playerId === "player-1") return;
      event.preventDefault();
      if (engine.flap(playerId)) playSfx("flap");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSpectating, playSfx, stage]);

  const handleCanvasPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 || isSpectating) return;
    event.preventDefault();
    if (engineRef.current?.flap("player-1")) playSfx("flap");
  };

  const removeBurst = (id: number) => {
    setBursts((current) => current.filter((burst) => burst.id !== id));
  };

  const localPlayer = snapshot?.players.find((player) => player.id === "player-1" && !player.isBot);
  const showEliminationChoice =
    snapshot?.phase === "playing" && localPlayer?.phase === "eliminated" && !isSpectating;

  return (
    <main className="celestial-sky relative min-h-screen overflow-hidden px-3 py-4 text-foreground sm:px-6 sm:py-7">
      <PixelSceneDecor density="calm" />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-arcade text-[0.55rem] text-arcade-violet">MAGISTERIUM ARCADE</p>
            <h1 className="pixel-title text-2xl leading-relaxed text-arcade-ink sm:text-3xl">
              SKY FLAP <span className="text-arcade-cyan">MULTIPLAYER</span>
            </h1>
            {stage === "match" && isSpectating && (
              <span className="mt-1 inline-block border border-arcade-cyan bg-arcade-panel/90 px-2 py-1 font-arcade text-[0.45rem] text-arcade-cyan">
                MODO ESPECTADOR
              </span>
            )}
          </div>
          <Button type="button" variant="arcade" size="arcade" onClick={onBack}>
            VOLTAR ÀS OPÇÕES
          </Button>
        </header>

        {stage === "setup" ? (
          <section className="pixel-panel rounded-sm p-4 sm:p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-arcade text-[0.58rem] text-arcade-cyan sm:text-xs">
                  {mode === "bots"
                    ? "PARTIDA CONTRA BOTS · MESMO PERCURSO"
                    : "PARTIDA LOCAL · MESMO PERCURSO"}
                </p>
                <h2 className="pixel-title mt-2 text-xl text-arcade-ink sm:text-2xl">
                  PREPARE OS JOGADORES
                </h2>
                <p className="mt-2 font-game text-base text-muted-foreground sm:text-lg">
                  {mode === "bots"
                    ? "Cada bot tem personagem, estratégia de voo e estado próprios."
                    : "Cada vaga tem física própria e controla somente seu personagem."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="arcade"
                  size="arcade"
                  onClick={removeParticipant}
                  disabled={participants.length <= MIN_SKY_FLAP_PLAYERS}
                  aria-label="Remover o último jogador"
                >
                  −
                </Button>
                <span className="min-w-24 text-center font-arcade text-[0.55rem] text-arcade-violet">
                  {participants.length} JOGADORES
                </span>
                <Button
                  type="button"
                  variant="arcade"
                  size="arcade"
                  onClick={addParticipant}
                  disabled={participants.length >= MAX_SKY_FLAP_PLAYERS}
                  aria-label="Adicionar jogador"
                >
                  +
                </Button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {participants.map((participant, index) => (
                <PlayerSetupCard
                  key={participant.id}
                  participant={participant}
                  index={index}
                  onNameChange={updateName}
                  onCharacterChange={updateCharacter}
                />
              ))}
            </div>

            <div className="mt-5 flex flex-col items-center gap-3">
              <p className="text-center font-game text-base text-muted-foreground">
                {mode === "bots"
                  ? "VOCÊ: SPACE/CLIQUE · OS BOTS VOAM COM IA PRÓPRIA"
                  : "CONTROLES: P1 Space/clique · P2 Enter · P3 W · P4 ↑"}
              </p>
              <Button
                type="button"
                variant="arcade"
                size="arcade"
                className="w-full max-w-md"
                onClick={startMatch}
              >
                INICIAR PARTIDA
              </Button>
            </div>
          </section>
        ) : (
          <section className="pixel-panel rounded-sm p-3 sm:p-5" aria-label="Sky Flap Multiplayer">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="font-arcade text-[0.55rem] text-arcade-violet sm:text-xs">
                PORTAIS CELESTIAIS · {snapshot?.speedMultiplier.toFixed(2)}×
              </p>
              <div
                className="w-full max-w-64 border-2 border-arcade-panel-border bg-arcade-sky/65 sm:w-60"
                aria-live="polite"
                aria-label="Placar multiplayer"
              >
                {snapshot?.players.map((player, index) => (
                  <PlayerHudRow key={player.id} player={player} index={index} />
                ))}
              </div>
            </div>

            <div className="relative aspect-video w-full overflow-hidden border-[3px] border-arcade-panel-border bg-arcade-sky-deep shadow-[0_8px_0_var(--color-arcade-shadow)]">
              <canvas
                ref={canvasRef}
                width={C.width}
                height={C.height}
                className="absolute inset-0 h-full w-full cursor-pointer touch-none [image-rendering:pixelated]"
                onPointerDown={handleCanvasPointerDown}
                role="button"
                tabIndex={0}
                aria-label="Clique para impulsionar o jogador 1; os demais usam suas teclas de vaga"
              />

              {snapshot?.players.map((player, index) => {
                const isLocalPlayer = player.id === "player-1" && !player.isBot;
                if (player.phase === "eliminated" || (isLocalPlayer && isSpectating)) return null;
                return (
                  <div
                    key={player.id}
                    ref={(element) => {
                      if (element) playerElementsRef.current.set(player.id, element);
                      else playerElementsRef.current.delete(player.id);
                    }}
                    className={`pointer-events-none absolute h-16 w-16 ${isLocalPlayer ? "z-30" : "z-10"}`}
                    style={{
                      left: `${(player.playerX / C.width) * 100}%`,
                      top: `${(player.playerY / C.height) * 100}%`,
                      transform: "translate(-50%, -50%)",
                      opacity: isLocalPlayer ? 1 : 0.72,
                    }}
                    aria-hidden="true"
                    data-player-id={player.id}
                    data-local-player={isLocalPlayer}
                  >
                    {player.phase === "playing" && (
                      <PlayerMagicCloud
                        characterId={player.characterId}
                        speedProgress={Math.min(
                          1,
                          (snapshot.speedMultiplier - 1) / (C.maxSpeedMultiplier - 1),
                        )}
                      />
                    )}
                    {isLocalPlayer && (
                      <span className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap border-2 border-arcade-gold bg-arcade-ink px-2 py-1 font-arcade text-[0.48rem] text-arcade-gold shadow-[0_0_12px_var(--color-arcade-gold)] sm:text-[0.55rem]">
                        ▼ VOCÊ
                      </span>
                    )}
                    {isLocalPlayer && (
                      <span className="absolute -top-5 left-1/2 max-w-32 -translate-x-1/2 truncate border border-arcade-gold bg-arcade-panel/95 px-1.5 py-0.5 font-arcade text-[0.4rem] text-arcade-ink sm:text-[0.46rem]">
                        {player.name.toLocaleUpperCase()}
                      </span>
                    )}
                    {!isLocalPlayer && (
                      <span
                        className={`absolute -top-4 whitespace-nowrap border border-arcade-panel-border bg-arcade-panel/90 px-1 py-0.5 font-arcade text-[0.4rem] text-arcade-violet ${
                          index % 2 === 0 ? "left-0" : "right-0"
                        }`}
                      >
                        {player.isBot ? `BOT ${index}` : `P${index + 1}`}
                      </span>
                    )}
                    <div
                      ref={(element) => {
                        if (element) spriteElementsRef.current.set(player.id, element);
                        else spriteElementsRef.current.delete(player.id);
                      }}
                      className="absolute inset-0 z-10 flex items-center justify-center"
                    >
                      <span
                        className={
                          isLocalPlayer
                            ? "absolute h-14 w-14 border-2 border-arcade-gold bg-arcade-cyan/25 shadow-[0_0_20px_var(--color-arcade-cyan)]"
                            : "absolute h-9 w-9 bg-arcade-violet/10 shadow-[0_0_7px_var(--color-arcade-violet)]"
                        }
                      />
                      <GameplaySprite
                        characterId={player.characterId}
                        animation="jump"
                        size={isLocalPlayer ? 42 : 34}
                        className={`relative [image-rendering:pixelated] ${isLocalPlayer ? "" : "opacity-80"}`}
                      />
                    </div>
                    <span className="sr-only">
                      Vaga {index + 1}: {player.name}
                    </span>
                  </div>
                );
              })}

              {bursts.map((burst) => (
                <PlayerGameOverBurst
                  key={`${burst.playerId}-${burst.id}`}
                  {...burst}
                  onComplete={removeBurst}
                />
              ))}

              {snapshot?.countdownLabel && (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-arcade-ink/15">
                  <div className="pixel-panel min-w-36 px-7 py-5 text-center shadow-[5px_5px_0_var(--color-arcade-shadow)]">
                    <p className="font-arcade text-3xl text-arcade-violet sm:text-5xl">
                      {snapshot.countdownLabel}
                    </p>
                  </div>
                </div>
              )}

              {showEliminationChoice && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-arcade-ink/75 p-3 sm:p-5">
                  <section
                    className="pixel-panel w-full max-w-md rounded-sm p-4 text-center shadow-[6px_6px_0_var(--color-arcade-shadow)] sm:p-6"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="sky-flap-eliminated-title"
                  >
                    <h2
                      id="sky-flap-eliminated-title"
                      className="font-arcade text-sm text-arcade-violet sm:text-lg"
                    >
                      VOCÊ FOI ELIMINADO
                    </h2>
                    <p className="mt-3 font-game text-base text-muted-foreground">
                      O que você deseja fazer?
                    </p>
                    <CurrencyRewardCard
                      receipts={rewardReceipts.filter(
                        (receipt) => receipt.playerId === localPlayer?.id,
                      )}
                    />
                    <div className="mt-5 grid gap-3">
                      <Button type="button" variant="arcade" size="arcade" onClick={onBack}>
                        SAIR DA SALA
                      </Button>
                      <Button
                        type="button"
                        variant="arcade"
                        size="arcade"
                        onClick={() => setIsSpectating(true)}
                      >
                        CONTINUAR COMO ESPECTADOR
                      </Button>
                    </div>
                  </section>
                </div>
              )}

              {snapshot &&
                (snapshot.phase === "results" ||
                  snapshot.phase === "voting" ||
                  snapshot.phase === "decision") && (
                  <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-arcade-ink/80 p-3 sm:p-5">
                    <div className="pixel-panel my-auto w-full max-w-xl rounded-sm p-4 text-center sm:p-6">
                      <p className="font-arcade text-sm text-arcade-violet sm:text-lg">
                        FLAPP SKY FINALIZADO!
                      </p>
                      {snapshot.winnerId ? (
                        (() => {
                          const winner = snapshot.players.find(
                            (player) => player.id === snapshot.winnerId,
                          )!;
                          const character = playableCharacterSeeds.find(
                            (entry) => entry.id === winner.characterId,
                          );
                          return (
                            <div className="mt-3 flex items-center justify-center gap-3">
                              <img
                                src={character?.sprite}
                                alt=""
                                aria-hidden="true"
                                width={48}
                                height={48}
                                className="h-12 w-12 object-contain [image-rendering:pixelated]"
                              />
                              <p className="text-left font-arcade text-[0.6rem] leading-relaxed text-arcade-ink sm:text-xs">
                                🏆 1º · {winner.name.toLocaleUpperCase()} · {character?.shortName}
                                <br />
                                <span className="text-arcade-cyan">
                                  {winner.score} PONTOS · 🪙 {getSkyFlapCoinReward(winner.score)}
                                </span>
                              </p>
                            </div>
                          );
                        })()
                      ) : (
                        <p className="mt-2 font-game text-base text-muted-foreground">
                          Todos foram eliminados. A classificação considera pontuação e ordem de
                          sobrevivência.
                        </p>
                      )}

                      <h2 className="mt-5 font-arcade text-[0.58rem] text-arcade-cyan sm:text-xs">
                        CLASSIFICAÇÃO FINAL
                      </h2>
                      <ol className="mt-2 space-y-1 text-left">
                        {snapshot.ranking.map((player, index) => {
                          const character = playableCharacterSeeds.find(
                            (entry) => entry.id === player.characterId,
                          );
                          return (
                            <li
                              key={player.id}
                              className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 border-b border-arcade-panel-border/50 py-1.5 text-left"
                            >
                              <span className="font-arcade text-[0.48rem] text-arcade-violet">
                                {index + 1}º
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-arcade text-[0.46rem] text-arcade-ink sm:text-[0.58rem]">
                                  {player.name.toLocaleUpperCase()} — {character?.shortName}
                                </span>
                                <span className="block font-game text-sm text-muted-foreground">
                                  {player.id === snapshot.winnerId ? "VENCEDOR" : "ELIMINADO"} ·{" "}
                                  {player.score} PONTOS · 🪙 {getSkyFlapCoinReward(player.score)}
                                </span>
                              </span>
                            </li>
                          );
                        })}
                      </ol>
                      <CurrencyRewardCard receipts={rewardReceipts} />

                      {snapshot.phase === "results" && (
                        <p className="mt-4 font-game text-sm text-muted-foreground">
                          Resultado final registrado. A votação multiplayer será aberta em
                          instantes.
                        </p>
                      )}

                      {snapshot.phase === "voting" && (
                        <section className="mt-5 border-t-2 border-arcade-panel-border pt-4 text-left">
                          <h2 className="text-center font-arcade text-[0.58rem] text-arcade-cyan sm:text-xs">
                            VOTAÇÃO MULTIPLAYER · {snapshot.votingSecondsRemaining}/
                            {SKY_FLAP_VOTE_SECONDS}s
                          </h2>
                          <p className="mt-2 text-center font-game text-sm text-muted-foreground">
                            Votaram{" "}
                            {snapshot.voteCounts.rematch + snapshot.voteCounts["change-game"]} de{" "}
                            {snapshot.humanVoterCount} humanos · empate ou timeout prioriza
                            revanche.
                          </p>
                          <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                            {snapshot.players
                              .filter((voter) => !voter.isBot)
                              .map((voter) => {
                                const playerVote = snapshot.votesByPlayer[voter.id];
                                return (
                                  <div
                                    key={voter.id}
                                    className="border border-arcade-panel-border bg-arcade-sky/35 p-2"
                                  >
                                    <p className="mb-2 truncate font-arcade text-[0.48rem] text-arcade-ink">
                                      {voter.name.toLocaleUpperCase()}
                                      {voter.id === "player-1" ? " · VOCÊ" : ""}
                                      {playerVote
                                        ? ` · VOTO: ${playerVote === "rematch" ? "REVANCHE" : "MUDAR DE JOGO"}`
                                        : " · AGUARDANDO"}
                                    </p>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      <Button
                                        type="button"
                                        variant="arcade"
                                        size="arcade"
                                        aria-pressed={playerVote === "rematch"}
                                        className={
                                          playerVote === "rematch" ? "ring-2 ring-arcade-gold" : ""
                                        }
                                        onClick={() => castVote(voter.id, "rematch")}
                                      >
                                        REVANCHE
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="arcade"
                                        size="arcade"
                                        aria-pressed={playerVote === "change-game"}
                                        className={
                                          playerVote === "change-game"
                                            ? "ring-2 ring-arcade-gold"
                                            : ""
                                        }
                                        onClick={() => castVote(voter.id, "change-game")}
                                      >
                                        MUDAR DE JOGO
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </section>
                      )}

                      {snapshot.phase === "decision" && (
                        <div className="mt-5 border-t-2 border-arcade-panel-border pt-4">
                          <p className="font-arcade text-xs text-arcade-cyan">
                            VOTAÇÃO ENCERRADA ·{" "}
                            {snapshot.voteDecision === "change-game" ? "MUDAR DE JOGO" : "REVANCHE"}
                          </p>
                          <p className="mt-2 font-game text-sm text-muted-foreground">
                            {snapshot.voteDecision === "change-game"
                              ? "A maioria escolheu voltar à seleção de minigames."
                              : "A revanche retorna à pré-partida com os mesmos participantes."}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
            </div>

            <p className="mt-3 text-center font-game text-sm text-muted-foreground sm:text-base">
              P1: SPACE/CLIQUE · P2: ENTER · P3: W · P4: ↑ · cada comando afeta apenas sua vaga
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
