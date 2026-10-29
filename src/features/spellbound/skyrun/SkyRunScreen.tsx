import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

import { Button } from "@/components/ui/button";

import { GameplaySprite } from "../gameplay/sprites/GameplaySprite";
import type { AnimationState } from "../gameplay/sprites/types";
import { getCharacterById } from "../data/characters";
import { PixelSceneDecor } from "../components/PixelSceneDecor";
import { CurrencyRewardCard } from "../components/CurrencyRewardCard";
import { createMatchId, useMatchCurrencyRewards } from "../currency";
import { submitGlobalRecord } from "../leaderboard/api";
import { useArcadeAudio } from "../audio/ArcadeAudioProvider";
import type { PlayableCharacterId } from "../types";
import { SKY_RUN_CONFIG as C, SKY_RUN_WORLD_NAMES } from "./config";
import { SkyRunEngine, type SkyRunPhase } from "./engine";
import { drawSkyRun } from "./render";

const BEST_SCORE_KEY = "spellbound-sky-run-best-v1";

interface SkyRunScreenProps {
  characterId: PlayableCharacterId | null;
  playerName: string;
  primaryWalletId: string;
  onBack: () => void;
}

interface HudState {
  phase: SkyRunPhase;
  score: number;
  bestScore: number;
  worldIndex: number;
  speedMultiplier: number;
  coinsCollected: number;
}

interface DeathBurstState {
  x: number;
  y: number;
  id: number;
}

const CHARACTER_BURST_COLORS: Record<
  PlayableCharacterId,
  { main: string; light: string; glow: string }
> = {
  "white-fox-ice-mage": {
    main: "#76dfff",
    light: "#e5fbff",
    glow: "rgba(104, 210, 255, 0.68)",
  },
  "purple-rabbit-ninja": {
    main: "#a888ed",
    light: "#e2d2ff",
    glow: "rgba(177, 136, 255, 0.62)",
  },
  "swamp-frog-mage": {
    main: "#58bd7b",
    light: "#c8f0a8",
    glow: "rgba(112, 229, 167, 0.58)",
  },
  "forge-raccoon-mage": {
    main: "#e66c43",
    light: "#ffc16d",
    glow: "rgba(255, 122, 57, 0.64)",
  },
  "time-owl-mage": {
    main: "#8275d2",
    light: "#e0d9ff",
    glow: "rgba(164, 143, 255, 0.62)",
  },
  "calm-capybara-mage": {
    main: "#83c9aa",
    light: "#d9f7e9",
    glow: "rgba(157, 232, 207, 0.62)",
  },
  "axolotl-mage": {
    main: "#e878b7",
    light: "#ffe1f3",
    glow: "rgba(255, 158, 219, 0.68)",
  },
};

function readBestScore() {
  try {
    const saved = Number(window.localStorage.getItem(BEST_SCORE_KEY));
    return Number.isFinite(saved) ? Math.max(0, Math.floor(saved)) : 0;
  } catch {
    return 0;
  }
}

function formatScore(score: number) {
  return String(score).padStart(6, "0");
}

function CharacterDeathBurst({
  characterId,
  x,
  y,
  id,
  onComplete,
}: DeathBurstState & {
  characterId: PlayableCharacterId;
  onComplete: (id: number) => void;
}) {
  const colors = CHARACTER_BURST_COLORS[characterId];

  return (
    <div
      className="pointer-events-none absolute z-0"
      style={{
        left: `${(x / C.width) * 100}%`,
        top: `${(y / C.height) * 100}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <svg
        key={id}
        className="h-16 w-16 animate-ping"
        viewBox="0 0 64 64"
        shapeRendering="crispEdges"
        aria-hidden="true"
        data-death-theme={characterId}
        onAnimationEnd={() => onComplete(id)}
        style={{
          filter: `drop-shadow(0 0 7px ${colors.glow})`,
          animationDuration: `${C.collisionEffectDurationMs}ms`,
          animationIterationCount: 1,
        }}
      >
        <path d="M29 2h6v5h-6zM57 29h5v6h-5zM29 57h6v5h-6zM2 29h5v6H2z" fill={colors.light} />
        {characterId === "white-fox-ice-mage" && (
          <g fill={colors.main}>
            <path d="m13 19 7-15 8 18h-6v9h-5v-9zM40 44l5-12 7 15h-5v8h-5v-8z" />
            <path d="m44 13 3-7 4 9h-3v6h-3v-6z" fill={colors.light} />
          </g>
        )}
        {characterId === "purple-rabbit-ninja" && (
          <g fill={colors.main}>
            <path d="m15 17 8 3 8-5-4 9 5 8-10-2-6 8-1-10-9-4 10-1zM42 43l6 2 7-4-3 7 4 6-8-1-5 6-1-8-7-3 8-1z" />
            <path d="m43 9 2-5 2 5 5 2-5 2-2 5-2-5-5-2z" fill={colors.light} />
          </g>
        )}
        {characterId === "swamp-frog-mage" && (
          <g fill={colors.main}>
            <path d="M11 20h5v5h6v4h-6v-2h-5zM42 39h5v5h6v4h-6v-2h-5z" />
            <circle cx="47" cy="16" r="5" fill="none" stroke={colors.light} strokeWidth="2" />
            <circle cx="17" cy="47" r="3" fill="none" stroke={colors.light} strokeWidth="2" />
          </g>
        )}
        {characterId === "forge-raccoon-mage" && (
          <g fill={colors.main}>
            <path d="M13 28v-9h4v-9h5v10h4v9h-4v6h-9zM40 51v-9h4v-9h5v10h4v9h-4v6h-9z" />
            <path d="M46 17h4v4h-4zM10 42h4v4h-4zM53 28h4v4h-4z" fill={colors.light} />
          </g>
        )}
        {characterId === "time-owl-mage" && (
          <g fill={colors.main} stroke={colors.light} strokeWidth="1">
            <circle cx="47" cy="17" r="8" fill="#7168b8" />
            <path
              d="M47 11v6l4 2M16 42h3v4h3v3h-3v-2h-3zM18 11h2v4h3v2h-3v4h-2v-4h-3v-2h3z"
              fill="none"
            />
            <path d="M11 31h5v2h-5zM50 43h3v3h-3z" fill="none" />
          </g>
        )}
      </svg>
    </div>
  );
}

export function SkyRunScreen({
  characterId: selectedCharacterId,
  playerName,
  primaryWalletId,
  onBack,
}: SkyRunScreenProps) {
  const engineRef = useRef<SkyRunEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new SkyRunEngine(undefined, C.playerX, { loopWorlds: true });
  }
  const engine = engineRef.current;
  const { playSfx, setMusicIntensity } = useArcadeAudio();
  const characterId = selectedCharacterId ?? "white-fox-ice-mage";
  const character = getCharacterById(characterId);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<HudState>(() => ({
    phase: engine.phase,
    score: engine.score,
    bestScore: engine.bestScore,
    worldIndex: engine.worldIndex,
    speedMultiplier: engine.snapshot().speedMultiplier,
    coinsCollected: engine.coinsCollected,
  }));
  const [matchId, setMatchId] = useState(() => createMatchId("sky-run"));
  const [spriteAnimation, setSpriteAnimation] = useState<AnimationState>("idle");
  const [deathBurst, setDeathBurst] = useState<DeathBurstState | null>(null);
  const previousPhaseRef = useRef<SkyRunPhase>(engine.phase);
  const previousGroundedRef = useRef(true);
  const audioMatchIdRef = useRef(matchId);
  const audioStartPlayedRef = useRef(false);
  const audioSnapshotRef = useRef<HudState | null>(null);
  const jumpEffectRef = useRef<{ kind: "takeoff" | "landing"; startedAt: number } | null>(null);
  const rewardReceipts = useMatchCurrencyRewards(
    matchId,
    hud.phase === "gameover"
      ? [
          {
            walletId: primaryWalletId,
            playerId: "player-1",
            playerName,
            amount: hud.coinsCollected,
          },
        ]
      : [],
    primaryWalletId,
  );

  useEffect(() => {
    engine.setBestScore(readBestScore());
    const snapshot = engine.snapshot();
    setHud({
      phase: engine.phase,
      score: engine.score,
      bestScore: engine.bestScore,
      worldIndex: engine.worldIndex,
      speedMultiplier: snapshot.speedMultiplier,
      coinsCollected: snapshot.coinsCollected,
    });
  }, [engine]);

  useEffect(() => {
    audioMatchIdRef.current = matchId;
    audioStartPlayedRef.current = false;
    audioSnapshotRef.current = {
      phase: engine.phase,
      score: engine.score,
      bestScore: engine.bestScore,
      worldIndex: engine.worldIndex,
      speedMultiplier: engine.snapshot().speedMultiplier,
      coinsCollected: engine.coinsCollected,
    };
  }, [engine, matchId]);

  useEffect(() => {
    if (audioMatchIdRef.current !== matchId) {
      audioMatchIdRef.current = matchId;
      audioStartPlayedRef.current = false;
      audioSnapshotRef.current = hud;
      return;
    }

    const previous = audioSnapshotRef.current;
    if (!previous) {
      audioSnapshotRef.current = hud;
      return;
    }

    if (previous.phase !== "playing" && hud.phase === "playing") {
      if (!audioStartPlayedRef.current) playSfx("game-start");
      audioStartPlayedRef.current = true;
    }
    if (hud.phase === "playing" && hud.coinsCollected > previous.coinsCollected) {
      const collected = hud.coinsCollected - previous.coinsCollected;
      playSfx("coin", { volume: Math.min(1.2, 0.9 + collected * 0.08) });
    }
    if (hud.worldIndex > previous.worldIndex) playSfx("level-clear");
    if (previous.phase === "playing" && hud.phase === "gameover") playSfx("game-over");

    audioSnapshotRef.current = hud;
  }, [hud, matchId, playSfx]);

  useEffect(() => {
    const runProgress = Math.min(
      1,
      Math.max(0, (hud.speedMultiplier - 1) / (C.maxSpeedMultiplier - 1)),
    );
    setMusicIntensity(0.86 + runProgress * 0.32);
  }, [hud.speedMultiplier, setMusicIntensity]);

  useEffect(() => () => setMusicIntensity(0.86), [setMusicIntensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let frame = 0;
    let previous = performance.now();
    let lastHudKey = "";
    let lastAnimation: AnimationState = "idle";
    let savedBest = engine.bestScore;
    let submittedBest = savedBest;

    const loop = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - previous) / 1000));
      previous = now;
      engine.step(dt);
      const snapshot = engine.snapshot();

      if (snapshot.phase !== previousPhaseRef.current) {
        if (snapshot.phase === "gameover" && previousPhaseRef.current === "playing") {
          setDeathBurst({
            x: C.playerX,
            y: C.groundY - snapshot.jumpHeight - C.playerSpriteHeight / 3,
            id: now,
          });
          jumpEffectRef.current = null;
        } else if (snapshot.phase === "ready") {
          setDeathBurst(null);
        }
        previousPhaseRef.current = snapshot.phase;
      }

      if (snapshot.phase === "playing" && previousGroundedRef.current && !snapshot.isGrounded) {
        jumpEffectRef.current = { kind: "takeoff", startedAt: now };
      } else if (
        snapshot.phase === "playing" &&
        !previousGroundedRef.current &&
        snapshot.isGrounded
      ) {
        jumpEffectRef.current = { kind: "landing", startedAt: now };
      }
      previousGroundedRef.current = snapshot.isGrounded;

      const activeJumpEffect = jumpEffectRef.current;
      const jumpAge = activeJumpEffect
        ? (now - activeJumpEffect.startedAt) / C.jumpEffectDurationMs
        : 1;
      const jumpKind = activeJumpEffect && jumpAge < 1 ? activeJumpEffect.kind : null;
      drawSkyRun(ctx, snapshot, now / 1000, characterId, {
        jumpKind,
        jumpProgress: Math.min(1, jumpAge),
        showFinalPortal: false,
      });

      const player = playerRef.current;
      if (player) {
        const playerTop = C.groundY - snapshot.jumpHeight - C.playerSpriteHeight;
        player.style.left = `${(C.playerX / C.width) * 100}%`;
        player.style.top = `${(playerTop / C.height) * 100}%`;
      }

      const nextAnimation: AnimationState =
        snapshot.phase === "gameover"
          ? "hurt"
          : snapshot.phase === "ready"
            ? "idle"
            : snapshot.isGrounded
              ? "run"
              : "jump";
      if (nextAnimation !== lastAnimation) {
        lastAnimation = nextAnimation;
        setSpriteAnimation(nextAnimation);
      }

      const hudKey = `${snapshot.phase}|${snapshot.score}|${snapshot.bestScore}|${snapshot.worldIndex}|${snapshot.speedMultiplier.toFixed(2)}|${snapshot.coinsCollected}`;
      if (hudKey !== lastHudKey) {
        lastHudKey = hudKey;
        setHud({
          phase: snapshot.phase,
          score: snapshot.score,
          bestScore: snapshot.bestScore,
          worldIndex: snapshot.worldIndex,
          speedMultiplier: snapshot.speedMultiplier,
          coinsCollected: snapshot.coinsCollected,
        });
      }

      if (snapshot.bestScore > savedBest) {
        savedBest = snapshot.bestScore;
        try {
          window.localStorage.setItem(BEST_SCORE_KEY, String(savedBest));
        } catch {
          // The current run remains playable if browser storage is unavailable.
        }
      }

      if (snapshot.phase === "gameover" && snapshot.bestScore > submittedBest) {
        submittedBest = snapshot.bestScore;
        void submitGlobalRecord("sky-run", snapshot.bestScore);
      }

      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [characterId, engine]);

  const handleJumpInput = useCallback(() => {
    const result = engine.pressJump();
    if (result === "started" && !audioStartPlayedRef.current) {
      audioStartPlayedRef.current = true;
      playSfx("game-start");
    }
    if (result === "jumped") {
      playSfx("jump");
      jumpEffectRef.current = { kind: "takeoff", startedAt: performance.now() };
    }
  }, [engine, playSfx]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("button, input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      event.preventDefault();
      handleJumpInput();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleJumpInput]);

  const handleCanvasPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    handleJumpInput();
  };

  const restart = () => {
    engine.reset();
    setMatchId(createMatchId("sky-run"));
    const snapshot = engine.snapshot();
    previousPhaseRef.current = snapshot.phase;
    previousGroundedRef.current = snapshot.isGrounded;
    jumpEffectRef.current = null;
    setDeathBurst(null);
    setSpriteAnimation("idle");
    setHud({
      phase: snapshot.phase,
      score: snapshot.score,
      bestScore: snapshot.bestScore,
      worldIndex: snapshot.worldIndex,
      speedMultiplier: snapshot.speedMultiplier,
      coinsCollected: snapshot.coinsCollected,
    });
  };

  const completeDeathBurst = (id: number) => {
    setDeathBurst((current) => (current?.id === id ? null : current));
  };

  const speedText = `${hud.speedMultiplier.toFixed(2)}×`;

  return (
    <main className="celestial-sky relative min-h-screen overflow-hidden px-3 py-4 text-foreground sm:px-6 sm:py-7">
      <PixelSceneDecor density="calm" />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-arcade text-[0.55rem] text-arcade-violet">MAGISTERIUM ARCADE</p>
            <h1 className="pixel-title text-2xl leading-relaxed text-arcade-ink sm:text-3xl">
              SKY RUN
            </h1>
            <p className="mt-1 font-game text-base text-muted-foreground sm:text-lg">
              CORRIDA CELESTIAL COM {character?.shortName ?? "RAPOSA"}
            </p>
          </div>
          <Button type="button" variant="arcade" size="arcade" onClick={onBack}>
            VOLTAR À MODALIDADE
          </Button>
        </header>

        <section className="pixel-panel rounded-sm p-3 sm:p-5" aria-label="Minigame Sky Run">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-arcade text-[0.55rem] text-arcade-violet sm:text-xs">
              MUNDO {hud.worldIndex + 1} · {SKY_RUN_WORLD_NAMES[hud.worldIndex] ?? "CÉU ENCANTADO"}
            </p>
            <div
              className="flex items-center gap-3 border-2 border-arcade-panel-border bg-arcade-sky/45 px-3 py-2 font-arcade text-[0.48rem] text-arcade-ink sm:text-[0.6rem]"
              aria-live="polite"
              aria-label={`Mundo ${hud.worldIndex + 1}, ${SKY_RUN_WORLD_NAMES[hud.worldIndex] ?? "Céu Encantado"}, pontos ${hud.score}, moedas ${hud.coinsCollected}, melhor ${hud.bestScore}, velocidade ${speedText}`}
            >
              <span>PONTOS: {formatScore(hud.score)}</span>
              <span className="text-arcade-gold">🪙 {hud.coinsCollected}</span>
              <span className="text-arcade-violet">MELHOR: {formatScore(hud.bestScore)}</span>
              <span className="hidden text-arcade-cyan sm:inline">RITMO: {speedText}</span>
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
              aria-label="Sky Run: pressione espaço para iniciar; depois, use espaço ou clique para pular"
            />
            <div
              ref={playerRef}
              className="pointer-events-none absolute z-10 -translate-x-1/2"
              style={{
                left: `${(C.playerX / C.width) * 100}%`,
                top: `${((C.groundY - C.playerSpriteHeight) / C.height) * 100}%`,
                width: `${(C.playerSpriteWidth / C.width) * 100}%`,
                height: `${(C.playerSpriteHeight / C.height) * 100}%`,
              }}
              aria-hidden="true"
            >
              <span className="absolute bottom-0 left-1/2 h-[12%] w-[70%] -translate-x-1/2 bg-arcade-cyan/15 shadow-[0_0_18px_var(--color-arcade-cyan)]" />
              <GameplaySprite
                characterId={characterId}
                animation={spriteAnimation}
                size={C.playerSpriteWidth}
                facing="right"
                sourceFacing="left"
                footAnchored
                className="absolute inset-0 h-full w-full drop-shadow-[0_0_5px_rgba(210,250,255,0.72)] [image-rendering:pixelated]"
              />
            </div>

            {hud.phase === "ready" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-arcade-ink/12 p-3">
                <div className="border-2 border-arcade-cloud bg-arcade-panel/95 px-4 py-3 text-center shadow-[5px_5px_0_var(--color-arcade-shadow)] sm:px-7 sm:py-5">
                  <p className="font-arcade text-[0.55rem] text-arcade-violet sm:text-sm">
                    PRESSIONE ESPAÇO PARA CORRER
                  </p>
                  <p className="mt-2 font-game text-base text-arcade-ink sm:text-xl">
                    depois, pule para desviar dos obstáculos
                  </p>
                  <p className="mt-1 font-game text-sm text-muted-foreground sm:text-base">
                    ou clique para iniciar a corrida
                  </p>
                </div>
              </div>
            )}

            {hud.phase === "gameover" && (
              <div className="absolute inset-0 flex items-center justify-center bg-arcade-ink/65 p-3">
                {deathBurst && (
                  <CharacterDeathBurst
                    {...deathBurst}
                    characterId={characterId}
                    onComplete={completeDeathBurst}
                  />
                )}
                <div className="pixel-panel relative z-10 w-full max-w-sm rounded-sm p-4 text-center sm:p-6">
                  <p className="font-arcade text-sm text-arcade-violet sm:text-lg">GAME OVER</p>
                  <p className="mt-4 font-arcade text-[0.6rem] text-arcade-ink sm:text-xs">
                    PONTOS: {formatScore(hud.score)}
                  </p>
                  <p className="mt-2 font-arcade text-[0.55rem] text-arcade-cyan sm:text-[0.65rem]">
                    MELHOR: {formatScore(hud.bestScore)}
                  </p>
                  <CurrencyRewardCard receipts={rewardReceipts} />
                  <Button
                    type="button"
                    variant="arcade"
                    size="arcade"
                    className="mt-5 w-full"
                    onClick={restart}
                  >
                    JOGAR NOVAMENTE
                  </Button>
                </div>
              </div>
            )}
          </div>

          <p className="mt-3 text-center font-game text-base text-muted-foreground sm:text-lg">
            ESPAÇO ou CLIQUE = pular · só é possível pular novamente depois de aterrissar
          </p>
        </section>
      </div>
    </main>
  );
}
