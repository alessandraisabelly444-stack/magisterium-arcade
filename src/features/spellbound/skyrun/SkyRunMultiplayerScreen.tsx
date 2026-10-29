import { useEffect, useRef, useState, type PointerEvent } from "react";

import { Button } from "@/components/ui/button";

import { CurrencyRewardCard } from "../components/CurrencyRewardCard";
import { PixelSceneDecor } from "../components/PixelSceneDecor";
import { createMatchId, useMatchCurrencyRewards, walletIdForLocalSlot } from "../currency";
import { submitGlobalRecord } from "../leaderboard/api";
import { useArcadeAudio } from "../audio/ArcadeAudioProvider";
import { playableCharacterSeeds } from "../data/characters";
import { GameplaySprite } from "../gameplay/sprites/GameplaySprite";
import type { PlayableCharacterId } from "../types";
import { SKY_RUN_CONFIG as C, SKY_RUN_WORLD_NAMES } from "./config";
import {
  SKY_RUN_PLAYER_CONTROLS,
  SkyRunMultiplayerEngine,
  type SkyRunPostMatchVote,
  type SkyRunMatchPlayer,
  type SkyRunMultiplayerSnapshot,
  type SkyRunParticipantConfig,
} from "./multiplayerEngine";
import { drawSkyRunPlayerEffects, drawSkyRunWorld } from "./render";

interface SetupParticipant extends SkyRunParticipantConfig {
  isBot: boolean;
}

const PLAYER_KEYS = ["Space", "Enter", "KeyW", "ArrowUp"] as const;

function initialParticipants(
  playerName: string,
  selectedCharacterId: PlayableCharacterId | null,
  mode: "local" | "bots",
): SetupParticipant[] {
  const playerOne: SetupParticipant = {
    id: "player-1",
    name: playerName.trim() || "JOGADOR",
    characterId: selectedCharacterId ?? playableCharacterSeeds[0]!.id,
    isBot: false,
  };
  if (mode === "local") {
    return [
      playerOne,
      {
        id: "player-2",
        name: "JOGADOR 2",
        characterId: playableCharacterSeeds[1]!.id,
        isBot: false,
      },
    ];
  }

  return [
    playerOne,
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

function createWorldPlayerSnapshot(
  world: SkyRunMultiplayerSnapshot["world"],
  player: SkyRunMatchPlayer,
): SkyRunMultiplayerSnapshot["world"] {
  return {
    ...world,
    phase: player.phase,
    score: player.score,
    bestScore: player.bestScore,
    jumpHeight: player.jumpHeight,
    playerVelocityY: player.playerVelocityY,
    isGrounded: player.isGrounded,
  };
}

function LivePlayerScoreRow({ player, place }: { player: SkyRunMatchPlayer; place: number }) {
  const character = playableCharacterSeeds.find((entry) => entry.id === player.characterId);
  const statusLabel =
    player.status === "finished"
      ? "FINALIZADO"
      : player.status === "eliminated"
        ? "ELIMINADO"
        : "CORRENDO";

  return (
    <li
      className={`grid min-w-0 grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-1 border-b border-arcade-panel-border/50 px-1 py-0.5 text-[0.38rem] last:border-0 sm:text-[0.45rem] ${player.status === "racing" ? "" : "opacity-60"}`}
      aria-label={`${place}º, ${player.name}, ${player.score} pontos, ${statusLabel.toLocaleLowerCase()}`}
      title={`${place}º · ${player.name} · ${player.score} pontos · ${statusLabel}`}
    >
      <span className="font-arcade text-arcade-violet">{place}º</span>
      <span
        className={`min-w-0 truncate font-arcade leading-tight ${player.id === "player-1" ? "text-arcade-cyan" : "text-arcade-ink"}`}
      >
        {player.name.toLocaleUpperCase()}
      </span>
      <span className="font-arcade text-arcade-cyan">
        {Math.floor(player.score)} · 🪙 {player.coinsCollected}
      </span>
    </li>
  );
}

function PlayerScoreRow({ player, place }: { player: SkyRunMatchPlayer; place: number }) {
  const character = playableCharacterSeeds.find((entry) => entry.id === player.characterId);
  const statusLabel =
    player.status === "finished"
      ? "FINALIZADO"
      : player.status === "eliminated"
        ? "ELIMINADO"
        : "CORRENDO";
  return (
    <li
      className={`grid grid-cols-[1.5rem_2rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-arcade-panel-border/50 px-2 py-1.5 last:border-0 ${player.phase === "gameover" ? "opacity-55" : ""}`}
      aria-label={`${place}º, ${player.name}, ${character?.shortName ?? "personagem"}, ${player.score} pontos, ${statusLabel.toLocaleLowerCase()}`}
    >
      <span className="font-arcade text-[0.48rem] text-arcade-violet">{place}º</span>
      <img
        src={character?.sprite}
        alt=""
        aria-hidden="true"
        width={30}
        height={30}
        className="h-7 w-7 object-contain [image-rendering:pixelated]"
      />
      <span className="min-w-0 truncate font-arcade text-[0.45rem] text-arcade-ink sm:text-[0.55rem]">
        {player.name.toLocaleUpperCase()} {player.isBot ? "· BOT" : "· VOCÊ"}
        <span className="block text-[0.38rem] text-muted-foreground sm:text-[0.45rem]">
          {character?.shortName} · {statusLabel}
          {` · 🪙 ${player.coinsCollected}`}
          {player.finishTimeSeconds !== null
            ? ` · ${player.finishTimeSeconds.toFixed(1)} s`
            : ` · DIST. ${Math.floor(player.distance)}`}
        </span>
      </span>
      <span className="font-arcade text-[0.45rem] text-arcade-cyan sm:text-[0.55rem]">
        {player.score}
      </span>
    </li>
  );
}

export function SkyRunMultiplayerScreen({
  playerName,
  selectedCharacterId,
  primaryWalletId,
  mode = "bots",
  onBack,
  onChangeGame,
}: {
  playerName: string;
  selectedCharacterId: PlayableCharacterId | null;
  primaryWalletId: string;
  mode?: "local" | "bots";
  onBack: () => void;
  onChangeGame: () => void;
}) {
  const { playSfx, setMusicIntensity } = useArcadeAudio();
  const [stage, setStage] = useState<"setup" | "match">("setup");
  const participants = useRef(initialParticipants(playerName, selectedCharacterId, mode));
  const engineRef = useRef<SkyRunMultiplayerEngine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRefs = useRef(new Map<string, HTMLDivElement>());
  const previousGroundedRef = useRef(new Map<string, boolean>());
  const jumpEffectsRef = useRef(
    new Map<string, { kind: "takeoff" | "landing"; startedAt: number }>(),
  );
  const [snapshot, setSnapshot] = useState<SkyRunMultiplayerSnapshot | null>(null);
  const previousAudioSnapshotRef = useRef<SkyRunMultiplayerSnapshot | null>(null);
  const audioEndPlayedRef = useRef(false);
  const [isSpectating, setIsSpectating] = useState(false);
  const [selectedVotes, setSelectedVotes] = useState<Record<string, SkyRunPostMatchVote | null>>(
    {},
  );
  const [matchId, setMatchId] = useState(() => createMatchId("sky-run"));
  const submittedGlobalRecordRef = useRef<string | null>(null);
  const matchIsFinal =
    snapshot !== null &&
    ["results", "voting", "decision", "rematch", "change-game"].includes(snapshot.phase);
  const finalizedRewardEntries =
    snapshot?.players.flatMap((player) => {
      if (player.isBot || (player.status === "racing" && !matchIsFinal)) return [];
      const humanSlot = snapshot.players
        .filter((candidate) => !candidate.isBot)
        .findIndex((candidate) => candidate.id === player.id);
      return [
        {
          walletId: humanSlot === 0 ? primaryWalletId : walletIdForLocalSlot(humanSlot),
          playerId: player.id,
          playerName: player.name,
          amount: player.coinsCollected,
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
    void submitGlobalRecord("sky-run", primaryPlayer.score);
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
      if (!oldPlayer) continue;
      if (player.coinsCollected > oldPlayer.coinsCollected) {
        const collected = player.coinsCollected - oldPlayer.coinsCollected;
        playSfx("coin", { volume: Math.min(1.2, 0.9 + collected * 0.08) });
      }
      if (player.status === "finished" && oldPlayer.status === "racing") {
        playSfx("level-clear", { volume: 0.72 });
      }
    }

    const primary = snapshot.players.find((player) => player.id === "player-1" && !player.isBot);
    const oldPrimary = previous.players.find((player) => player.id === "player-1" && !player.isBot);
    if (
      !audioEndPlayedRef.current &&
      primary?.status === "eliminated" &&
      oldPrimary?.status !== "eliminated"
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

    if (snapshot.world.worldIndex > previous.world.worldIndex) playSfx("level-clear");
    previousAudioSnapshotRef.current = snapshot;
  }, [playSfx, snapshot]);

  const runProgress = Math.min(
    1,
    Math.max(0, ((snapshot?.world.speedMultiplier ?? 1) - 1) / (C.maxSpeedMultiplier - 1)),
  );
  const runMusicIntensity = 0.86 + runProgress * 0.32;
  useEffect(() => {
    setMusicIntensity(runMusicIntensity);
  }, [runMusicIntensity, setMusicIntensity]);
  useEffect(() => () => setMusicIntensity(0.86), [setMusicIntensity]);

  const startMatch = () => {
    const configs: SkyRunParticipantConfig[] = participants.current.map((participant) => ({
      id: participant.id,
      name: participant.name,
      characterId: participant.characterId,
      isBot: participant.isBot,
      ...(participant.botDifficulty ? { botDifficulty: participant.botDifficulty } : {}),
    }));
    const engine = new SkyRunMultiplayerEngine(configs);
    engineRef.current = engine;
    previousGroundedRef.current = new Map(configs.map((participant) => [participant.id, true]));
    jumpEffectsRef.current.clear();
    setIsSpectating(false);
    setSelectedVotes({});
    previousAudioSnapshotRef.current = null;
    audioEndPlayedRef.current = false;
    setMatchId(createMatchId("sky-run"));
    setSnapshot(engine.snapshot());
    setStage("match");
  };

  useEffect(() => {
    if (stage !== "match") return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !engineRef.current) return;

    let frame = 0;
    let previousTime = performance.now();
    let previousHudKey = "";

    const loop = (now: number) => {
      const engine = engineRef.current;
      if (!engine) return;
      const deltaSeconds = Math.min(0.05, Math.max(0, (now - previousTime) / 1000));
      previousTime = now;
      engine.step(deltaSeconds);
      const current = engine.snapshot();
      const time = now / 1000;

      const visibleCoins = new Map(
        current.players
          .filter((player) => player.status === "racing")
          .flatMap((player) => player.coins)
          .map((coin) => [coin.id, coin] as const),
      );
      drawSkyRunWorld(context, { ...current.world, coins: [...visibleCoins.values()] }, time);
      for (const player of current.players) {
        const playerElement = playerRefs.current.get(player.id);
        const playerTop = C.groundY - player.jumpHeight - C.multiplayerPlayerSpriteSize;
        if (playerElement) {
          playerElement.style.left = `${(player.playerX / C.width) * 100}%`;
          playerElement.style.top = `${(playerTop / C.height) * 100}%`;
          playerElement.style.opacity = player.status === "racing" ? "1" : "0";
        }

        if (player.status !== "racing") {
          previousGroundedRef.current.set(player.id, player.isGrounded);
          continue;
        }

        const wasGrounded = previousGroundedRef.current.get(player.id) ?? true;
        if (player.phase === "playing" && wasGrounded && !player.isGrounded) {
          jumpEffectsRef.current.set(player.id, { kind: "takeoff", startedAt: now });
        } else if (player.phase === "playing" && !wasGrounded && player.isGrounded) {
          jumpEffectsRef.current.set(player.id, { kind: "landing", startedAt: now });
        }
        previousGroundedRef.current.set(player.id, player.isGrounded);

        const effect = jumpEffectsRef.current.get(player.id);
        const jumpProgress = effect ? (now - effect.startedAt) / C.jumpEffectDurationMs : 1;
        const visualSnapshot = createWorldPlayerSnapshot(current.world, player);
        drawSkyRunPlayerEffects(
          context,
          visualSnapshot,
          time,
          player.characterId,
          {
            jumpKind: effect && jumpProgress < 1 ? effect.kind : null,
            jumpProgress: Math.min(1, jumpProgress),
          },
          player.playerX,
        );
      }

      const hudKey = [
        current.phase,
        current.countdownLabel,
        current.winnerId,
        current.world.worldIndex,
        current.votingSecondsRemaining,
        current.voteDecision,
        current.voteCounts.rematch,
        current.voteCounts["change-game"],
        ...current.players.flatMap((player) => [
          player.id,
          player.phase,
          player.status,
          player.isGrounded,
          player.score,
          player.coinsCollected,
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
      event.preventDefault();
      const playerId = `player-${index + 1}`;
      if (!isSpectating || playerId !== "player-1") {
        const result = engineRef.current?.jump(playerId);
        if (result && result !== "ignored") playSfx("jump");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSpectating, playSfx, stage]);

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 || isSpectating) return;
    event.preventDefault();
    const result = engineRef.current?.jump("player-1");
    if (result && result !== "ignored") playSfx("jump");
  };

  const resetToSetup = () => {
    engineRef.current = null;
    setSnapshot(null);
    setIsSpectating(false);
    setSelectedVotes({});
    setStage("setup");
  };

  useEffect(() => {
    if (snapshot?.phase === "rematch") resetToSetup();
    else if (snapshot?.phase === "change-game") onChangeGame();
  }, [onChangeGame, snapshot?.phase]);

  const castVote = (playerId: string, choice: SkyRunPostMatchVote) => {
    if (engineRef.current?.vote(playerId, choice)) {
      setSelectedVotes((current) => ({ ...current, [playerId]: choice }));
    }
  };

  const orderedPlayers = snapshot?.ranking ?? [];
  const humanControls =
    mode === "local"
      ? `P1 ${SKY_RUN_PLAYER_CONTROLS[0]} · P2 ${SKY_RUN_PLAYER_CONTROLS[1]}`
      : SKY_RUN_PLAYER_CONTROLS[0];
  const localPlayer = snapshot?.players.find((player) => player.id === "player-1");
  const worldIndex = snapshot?.world.worldIndex ?? 0;
  const worldName = SKY_RUN_WORLD_NAMES[worldIndex] ?? SKY_RUN_WORLD_NAMES[0];
  const speedMultiplier = snapshot?.world.speedMultiplier ?? 1;

  return (
    <main
      className={`celestial-sky relative overflow-hidden text-foreground ${stage === "match" ? "min-h-dvh px-2 py-2 sm:px-4 sm:py-3" : "min-h-screen px-3 py-4 sm:px-6 sm:py-7"}`}
    >
      <PixelSceneDecor density="calm" />
      <div
        className={`relative z-10 mx-auto flex w-full max-w-6xl flex-col ${stage === "match" ? "gap-2" : "gap-4"}`}
      >
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-arcade text-[0.55rem] text-arcade-violet">MAGISTERIUM ARCADE</p>
            <h1 className="pixel-title text-2xl leading-relaxed text-arcade-ink sm:text-3xl">
              SKY RUN{" "}
              <span className="text-arcade-cyan">
                {mode === "local" ? "PARTIDA LOCAL" : "MULTIPLAYER"}
              </span>
            </h1>
          </div>
          <Button type="button" variant="arcade" size="arcade" onClick={onBack}>
            VOLTAR ÀS OPÇÕES
          </Button>
        </header>

        {stage === "setup" ? (
          <section className="pixel-panel rounded-sm p-4 sm:p-6">
            <p className="font-arcade text-[0.58rem] text-arcade-cyan sm:text-xs">
              {mode === "local"
                ? "PARTIDA LOCAL · MESMO PERCURSO"
                : "PARTIDA CONTRA BOTS · MESMO PERCURSO"}
            </p>
            <h2 className="pixel-title mt-2 text-xl text-arcade-ink sm:text-2xl">
              {mode === "local" ? "DUAS PESSOAS · CONTROLES SEPARADOS" : "CORRA CONTRA A IA"}
            </h2>
            <p className="mt-2 font-game text-base text-muted-foreground sm:text-lg">
              {mode === "local"
                ? "Cada jogador controla seu próprio corredor no mesmo percurso."
                : "Cada corredor mantém seu estado e toma decisões de salto próprias."}
            </p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {participants.current.map((participant, index) => {
                const character = playableCharacterSeeds.find(
                  (entry) => entry.id === participant.characterId,
                );
                return (
                  <li
                    key={participant.id}
                    className="flex items-center gap-3 border-2 border-arcade-panel-border bg-arcade-sky/45 p-3"
                  >
                    <img
                      src={character?.sprite}
                      alt=""
                      aria-hidden="true"
                      width={42}
                      height={42}
                      className="h-10 w-10 object-contain [image-rendering:pixelated]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-arcade text-[0.52rem] text-arcade-ink sm:text-[0.62rem]">
                        {participant.name.toLocaleUpperCase()}
                      </span>
                      <span className="mt-1 block font-game text-sm text-muted-foreground">
                        {character?.shortName} ·{" "}
                        {participant.isBot ? `IA ${participant.botDifficulty}` : "JOGADOR"}
                      </span>
                    </span>
                    <span className="font-arcade text-[0.48rem] text-arcade-violet">
                      {participant.isBot ? "BOT" : `P${index + 1}`}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex flex-col items-center gap-3">
              <p className="text-center font-game text-base text-muted-foreground">
                {mode === "local"
                  ? `CONTROLES: ${humanControls}`
                  : `CONTROLE: ${humanControls} · OS BOTS USAM IA DE CORRIDA`}
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
          <section className="pixel-panel rounded-sm p-2 sm:p-3" aria-label="Sky Run Multiplayer">
            {mode === "local" &&
              snapshot?.phase === "playing" &&
              localPlayer?.status === "eliminated" &&
              !isSpectating && (
                <section
                  role="status"
                  aria-live="polite"
                  className="mb-2 flex flex-wrap items-center justify-between gap-2 border-2 border-arcade-pink bg-arcade-sky/80 px-3 py-2"
                >
                  <p className="font-arcade text-[0.48rem] text-arcade-pink sm:text-[0.56rem]">
                    P1 FOI ELIMINADO · P2 CONTINUA NO PERCURSO
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="arcade" size="arcade" onClick={onBack}>
                      SAIR DA PARTIDA
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
              )}
            <div
              className="relative mx-auto aspect-video w-full overflow-hidden border-[3px] border-arcade-panel-border bg-arcade-sky-deep shadow-[0_8px_0_var(--color-arcade-shadow)]"
              style={{ maxWidth: "calc(177.78dvh - 245px)" }}
            >
              <canvas
                ref={canvasRef}
                width={C.width}
                height={C.height}
                className="absolute inset-0 h-full w-full cursor-pointer touch-none [image-rendering:pixelated]"
                onPointerDown={handlePointerDown}
                role="button"
                tabIndex={0}
                aria-label={
                  mode === "local"
                    ? "Sky Run local: P1 usa Espaço ou clique; P2 usa Enter para pular"
                    : "Sky Run Multiplayer: Space ou clique para pular"
                }
              />

              <div
                className="pointer-events-none absolute inset-x-2 top-2 z-20 flex items-start gap-2 sm:inset-x-3 sm:top-3"
                aria-label="HUD do Sky Run"
              >
                <div
                  className={`min-w-0 rounded-sm border border-arcade-panel-border bg-arcade-panel/90 px-2 py-1.5 shadow-sm backdrop-blur-sm ${isSpectating ? "flex-1" : "w-fit max-w-full"}`}
                >
                  <p className="truncate font-arcade text-[0.38rem] leading-tight text-arcade-cyan sm:text-[0.48rem]">
                    MUNDO {worldIndex + 1}/{SKY_RUN_WORLD_NAMES.length} · {worldName}
                    {worldIndex === SKY_RUN_WORLD_NAMES.length - 1 ? " · ÚLTIMO MAPA" : ""}
                  </p>
                  <p className="mt-0.5 font-arcade text-[0.38rem] leading-tight text-arcade-violet sm:text-[0.48rem]">
                    PERCURSO · {speedMultiplier.toFixed(2)}×
                  </p>
                </div>
                {isSpectating && (
                  <span className="shrink-0 rounded-sm border border-arcade-cyan bg-arcade-panel/90 px-2 py-1.5 font-arcade text-[0.38rem] leading-tight text-arcade-cyan shadow-sm backdrop-blur-sm sm:text-[0.48rem]">
                    ESPECTANDO
                  </span>
                )}
              </div>

              <ol
                className="pointer-events-none absolute right-2 top-9 z-20 grid w-40 max-w-[56%] grid-cols-1 overflow-hidden rounded-sm border border-arcade-panel-border bg-arcade-panel/90 p-1 shadow-sm backdrop-blur-sm sm:right-3 sm:top-14 sm:w-52 sm:max-w-[42%]"
                aria-live="off"
                aria-label="Classificação ao vivo"
              >
                <li className="border-b border-arcade-panel-border/70 px-1 pb-1 font-arcade text-[0.34rem] text-arcade-violet sm:text-[0.4rem]">
                  RANKING
                </li>
                {orderedPlayers.map((player, index) => (
                  <LivePlayerScoreRow key={player.id} player={player} place={index + 1} />
                ))}
              </ol>

              {snapshot?.players
                .filter((player) => player.status === "racing")
                .map((player, index) => {
                  const character = playableCharacterSeeds.find(
                    (entry) => entry.id === player.characterId,
                  );
                  return (
                    <div
                      key={player.id}
                      ref={(element) => {
                        if (element) playerRefs.current.set(player.id, element);
                        else playerRefs.current.delete(player.id);
                      }}
                      className="pointer-events-none absolute z-10 -translate-x-1/2"
                      style={{
                        left: `${(player.playerX / C.width) * 100}%`,
                        top: `${((C.groundY - player.jumpHeight - C.multiplayerPlayerSpriteSize) / C.height) * 100}%`,
                        width: `${(C.multiplayerPlayerSpriteSize / C.width) * 100}%`,
                        height: `${(C.multiplayerPlayerSpriteSize / C.height) * 100}%`,
                      }}
                      aria-hidden="true"
                      data-player-id={player.id}
                    >
                      <span className="absolute -top-4 left-1/2 max-w-[58px] -translate-x-1/2 truncate border border-arcade-panel-border bg-arcade-panel/90 px-1 py-0.5 font-arcade text-[0.32rem] text-arcade-ink">
                        {player.isBot ? `BOT ${index}` : player.name.toLocaleUpperCase()}
                      </span>
                      <GameplaySprite
                        characterId={player.characterId}
                        animation={
                          player.phase === "gameover" ? "hurt" : player.isGrounded ? "run" : "jump"
                        }
                        size={C.multiplayerPlayerSpriteSize}
                        facing="right"
                        sourceFacing="left"
                        footAnchored
                        className="absolute inset-0 h-full w-full [image-rendering:pixelated]"
                      />
                      <span className="sr-only">
                        {player.name}, {character?.shortName}, {player.phase}
                      </span>
                    </div>
                  );
                })}

              {snapshot?.countdownLabel && (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-arcade-ink/15">
                  <div className="pixel-panel min-w-36 px-7 py-5 text-center shadow-[5px_5px_0_var(--color-arcade-shadow)]">
                    <p className="font-arcade text-3xl text-arcade-violet sm:text-5xl">
                      {snapshot.countdownLabel}
                    </p>
                  </div>
                </div>
              )}

              {snapshot && ["results", "voting", "decision"].includes(snapshot.phase) && (
                <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-arcade-ink/80 p-3 sm:p-5">
                  <div className="pixel-panel my-auto w-full max-w-lg rounded-sm p-4 text-center sm:p-6">
                    <p className="font-arcade text-sm text-arcade-violet sm:text-lg">
                      CORRIDA FINALIZADA
                    </p>
                    {snapshot.winnerId ? (
                      <p className="mt-2 font-game text-lg text-arcade-ink">
                        {snapshot.players.find((player) => player.id === snapshot.winnerId)?.name}
                        {" chegou primeiro ao portal."}
                      </p>
                    ) : (
                      <p className="mt-2 font-game text-base text-muted-foreground">
                        Todos foram eliminados; a classificação considera a ordem de eliminação e a
                        distância.
                      </p>
                    )}
                    <h2 className="mt-5 font-arcade text-[0.58rem] text-arcade-cyan sm:text-xs">
                      RESULTADO FINAL
                    </h2>
                    <ol className="mt-2 border-2 border-arcade-panel-border bg-arcade-sky/55 text-left">
                      {snapshot.ranking.map((player, index) => (
                        <PlayerScoreRow key={player.id} player={player} place={index + 1} />
                      ))}
                    </ol>
                    <CurrencyRewardCard receipts={rewardReceipts} />
                    {snapshot.phase === "results" && (
                      <p className="mt-4 font-game text-sm text-muted-foreground">
                        RESULTADO REGISTRADO · VOTAÇÃO EM INSTANTES
                      </p>
                    )}
                    {snapshot.phase === "voting" && (
                      <div className="mt-4 border-2 border-arcade-panel-border bg-arcade-sky/70 p-3">
                        <h3 className="font-arcade text-[0.55rem] text-arcade-violet sm:text-xs">
                          VOTAÇÃO — {snapshot.votingSecondsRemaining} SEGUNDOS
                        </h3>
                        <p className="mt-2 font-game text-sm text-arcade-ink">
                          REVANCHE: {snapshot.voteCounts.rematch} voto(s) · MUDAR DE JOGO:{" "}
                          {snapshot.voteCounts["change-game"]} voto(s)
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {snapshot.players
                            .filter((voter) => !voter.isBot)
                            .map((voter, voterIndex) => {
                              const voterChoice = selectedVotes[voter.id] ?? null;
                              return (
                                <div
                                  key={voter.id}
                                  className="border border-arcade-panel-border/70 p-2"
                                >
                                  <p className="font-arcade text-[0.42rem] text-arcade-violet">
                                    {mode === "local"
                                      ? `P${voterIndex + 1} · ${voter.name}`
                                      : "SEU VOTO"}
                                  </p>
                                  <div className="mt-2 flex flex-col gap-2">
                                    <Button
                                      type="button"
                                      variant="arcade"
                                      size="arcade"
                                      className="flex-1"
                                      disabled={voterChoice !== null}
                                      onClick={() => castVote(voter.id, "rematch")}
                                    >
                                      {voterChoice === "rematch" ? "VOTO: REVANCHE" : "REVANCHE"}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="arcade"
                                      size="arcade"
                                      className="flex-1"
                                      disabled={voterChoice !== null}
                                      onClick={() => castVote(voter.id, "change-game")}
                                    >
                                      {voterChoice === "change-game"
                                        ? "VOTO: MUDAR DE JOGO"
                                        : "MUDAR DE JOGO"}
                                    </Button>
                                  </div>
                                  {voterChoice && (
                                    <p className="mt-2 font-game text-xs text-muted-foreground">
                                      {mode === "local"
                                        ? `Voto de P${voterIndex + 1} registrado.`
                                        : "Seu voto foi registrado. Os bots não votam."}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                    {snapshot.phase === "decision" && (
                      <div className="mt-4 border-2 border-arcade-gold bg-arcade-sky/80 p-3">
                        <p className="font-arcade text-[0.6rem] text-arcade-ink sm:text-xs">
                          VOTAÇÃO CONCLUÍDA ·{" "}
                          {snapshot.voteDecision === "change-game" ? "MUDAR DE JOGO" : "REVANCHE"}
                        </p>
                        {snapshot.voteDecision === "rematch" &&
                          snapshot.voteCounts.rematch <= snapshot.humanVoterCount / 2 && (
                            <p className="mt-2 font-game text-xs text-muted-foreground">
                              Sem maioria definida: o empate favorece a revanche.
                            </p>
                          )}
                        <p className="mt-2 font-game text-sm text-muted-foreground">
                          Próxima etapa em {snapshot.decisionSecondsRemaining.toFixed(1)} s
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {mode === "bots" && localPlayer?.status === "eliminated" && !isSpectating && (
                <div className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-arcade-ink/85 p-3 sm:p-5">
                  <section
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="sky-run-eliminated-title"
                    className="pixel-panel my-auto w-full max-w-md rounded-sm p-5 text-center sm:p-7"
                  >
                    <h2
                      id="sky-run-eliminated-title"
                      className="font-arcade text-sm text-arcade-violet sm:text-lg"
                    >
                      VOCÊ FOI ELIMINADO
                    </h2>
                    <p className="mt-3 font-game text-base text-arcade-ink">
                      O que você deseja fazer?
                    </p>
                    <CurrencyRewardCard
                      receipts={rewardReceipts.filter(
                        (receipt) => receipt.playerId === localPlayer?.id,
                      )}
                    />
                    <div className="mt-5 flex flex-col gap-3">
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
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
