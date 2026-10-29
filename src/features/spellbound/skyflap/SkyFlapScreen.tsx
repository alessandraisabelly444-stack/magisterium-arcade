import { useEffect, useRef, useState, type PointerEvent } from "react";

import { Button } from "@/components/ui/button";

import { GameplaySprite } from "../gameplay/sprites/GameplaySprite";
import { getCharacterById } from "../data/characters";
import { CurrencyRewardCard } from "../components/CurrencyRewardCard";
import { createMatchId, useMatchCurrencyRewards } from "../currency";
import { submitGlobalRecord } from "../leaderboard/api";
import { useArcadeAudio } from "../audio/ArcadeAudioProvider";
import { PixelSceneDecor } from "../components/PixelSceneDecor";
import type { PlayableCharacterId } from "../types";
import { SKY_FLAP_CONFIG as C } from "./config";
import {
  getScrollSpeedMultiplier,
  getSkyFlapCoinReward,
  SkyFlapEngine,
  type SkyFlapPhase,
} from "./engine";
import { drawSkyFlap } from "./render";

const BEST_SCORE_KEY = "spellbound-sky-flap-best-v1";

interface SkyFlapScreenProps {
  characterId: PlayableCharacterId | null;
  playerName: string;
  primaryWalletId: string;
  onBack: () => void;
}

interface HudState {
  phase: SkyFlapPhase;
  score: number;
  bestScore: number;
  distance: number;
}

function readBestScore() {
  try {
    const saved = Number(window.localStorage.getItem(BEST_SCORE_KEY));
    return Number.isFinite(saved) ? Math.max(0, Math.floor(saved)) : 0;
  } catch {
    return 0;
  }
}

interface MagicCloudTheme {
  outline: string;
  body: string;
  highlight: string;
  underside: string;
  glow: string;
}

const MAGIC_CLOUD_THEMES: Record<PlayableCharacterId, MagicCloudTheme> = {
  "white-fox-ice-mage": {
    outline: "#63b9e5",
    body: "#c6efff",
    highlight: "#f7fdff",
    underside: "#84d2f3",
    glow: "rgba(104, 210, 255, 0.68)",
  },
  "purple-rabbit-ninja": {
    outline: "#6849a9",
    body: "#987bd5",
    highlight: "#e2d2ff",
    underside: "#7557bc",
    glow: "rgba(177, 136, 255, 0.58)",
  },
  "swamp-frog-mage": {
    outline: "#286c58",
    body: "#65ae7c",
    highlight: "#c8efb5",
    underside: "#3a8b7c",
    glow: "rgba(112, 229, 167, 0.54)",
  },
  "forge-raccoon-mage": {
    outline: "#713b3b",
    body: "#b85b42",
    highlight: "#ffc16d",
    underside: "#923d3b",
    glow: "rgba(255, 122, 57, 0.62)",
  },
  "time-owl-mage": {
    outline: "#514b91",
    body: "#8077c5",
    highlight: "#e0d9ff",
    underside: "#625ca8",
    glow: "rgba(164, 143, 255, 0.62)",
  },
  "calm-capybara-mage": {
    outline: "#516650",
    body: "#9a7157",
    highlight: "#d8b891",
    underside: "#6c5549",
    glow: "rgba(157, 232, 207, 0.58)",
  },
  "axolotl-mage": {
    outline: "#744565",
    body: "#ef8cc7",
    highlight: "#ffe1f3",
    underside: "#b65e9e",
    glow: "rgba(255, 158, 219, 0.62)",
  },
};

const CLOUD_SPEED_TRAIL_PARTICLES = [
  { x: 1, y: 16, size: 2 },
  { x: 5, y: 11, size: 1.5 },
  { x: 7, y: 22, size: 2 },
  { x: 11, y: 6, size: 1.5 },
] as const;

function PlayerMagicCloudDetails({ characterId }: { characterId: PlayableCharacterId }) {
  switch (characterId) {
    case "white-fox-ice-mage":
      return (
        <g>
          <path d="M13 9 17 1l4 8h-3l-1 4-2-4zM52 10l3-7 4 7h-3l-1 3-1-3z" fill="#e5faff" />
          <path d="M17 3v8M55 5v7" stroke="#83dfff" strokeWidth="1" />
          <g className="animate-pulse" fill="#f4fdff">
            <path d="M4 13h4v1H4zM5 12h1v4H5zM65 6h4v1h-4zM66 5h1v4h-1z" />
          </g>
          <rect x="10" y="3" width="2" height="2" fill="#a8edff" />
        </g>
      );
    case "purple-rabbit-ninja":
      return (
        <g>
          <path
            d="M2 17h3v-4h3v2H6v4H3v3H1v-3H2zM67 17h2v-4h2v6h-2v3h-2z"
            fill="#b69bff"
            opacity="0.8"
          />
          <g className="animate-pulse" fill="#e8dcff">
            <path d="M3 8 6 10l4-2-2 4 2 4-4-2-4 2 2-4z" />
          </g>
          <path d="m61 7 3 3 4-2-2 4 3 3-5 1-1 4-3-4-4 1 2-4-3-3 5-1z" fill="#d1baff" />
          <rect x="10" y="5" width="2" height="2" fill="#a98ce8" />
        </g>
      );
    case "swamp-frog-mage":
      return (
        <g>
          <path d="M8 9h3v3h3v2h-3v-1H8zM53 8h3v3h3v2h-3v-1h-3z" fill="#bde995" />
          <path d="M10 14h3v-2h2v4h-3v2h-2zM55 13h3v-2h2v4h-3v2h-2z" fill="#75ce9a" />
          <g fill="none" stroke="#c9ffe0" strokeWidth="1">
            <circle cx="5" cy="17" r="2" />
            <circle cx="67" cy="9" r="1.5" />
          </g>
          <g className="animate-pulse" fill="#a9f3cc">
            <circle cx="8" cy="5" r="1" />
            <circle cx="63" cy="19" r="1.2" />
          </g>
        </g>
      );
    case "forge-raccoon-mage":
      return (
        <g>
          <path d="M12 16v-4h2V8h2v4h2v5h-2v2h-4zM54 16v-3h2V9h2v4h2v4h-2v2h-4z" fill="#ff9a46" />
          <path
            d="M11 7h3v2h-3zM59 5h2v3h-2zM64 19h3v2h-3z"
            fill="#ffd77c"
            className="animate-pulse"
          />
          <path d="M20 18h3v2h-3zM49 18h3v2h-3z" fill="#f26b40" />
          <path d="M6 12h3v1H6zM7 11h1v3H7z" fill="#ffe19a" />
        </g>
      );
    case "time-owl-mage":
      return (
        <g>
          <path d="M9 9h2v2h2v2h-2v-1H9zM15 5h1v3h2v1h-2v3h-1V9h-2V8h2z" fill="#d1c8ff" />
          <circle cx="64" cy="12" r="4" fill="#6e68b5" stroke="#e1d9ff" strokeWidth="1" />
          <path d="M64 9v3l2 1M62 12h1" fill="none" stroke="#f4eaff" strokeWidth="1" />
          <g className="animate-pulse" fill="#f0eaff">
            <rect x="3" y="17" width="2" height="2" />
            <rect x="7" y="20" width="2" height="2" />
            <rect x="11" y="22" width="1.5" height="1.5" />
          </g>
          <path d="M55 5h2v2h-2zM59 4h1v3h-1z" fill="#b8a9ff" />
        </g>
      );
    case "calm-capybara-mage":
      return (
        <g fill="#b3efd7" className="animate-pulse">
          <circle cx="9" cy="11" r="2" />
          <circle cx="61" cy="7" r="1.5" />
          <path d="M15 18h4v1h-4zM52 14h3v1h-3z" />
        </g>
      );
    case "axolotl-mage":
      return (
        <g fill="#ffd2ed" className="animate-pulse">
          <path d="M8 8h3v4H8zM60 14h3v4h-3z" />
          <circle cx="17" cy="20" r="1.5" />
          <circle cx="54" cy="5" r="1.5" />
        </g>
      );
  }
  return null;
}

function PlayerMagicCloudSpeedParticle({
  characterId,
  particle,
  theme,
  speedProgress,
}: {
  characterId: PlayableCharacterId;
  particle: (typeof CLOUD_SPEED_TRAIL_PARTICLES)[number];
  theme: MagicCloudTheme;
  speedProgress: number;
}) {
  return (
    <g
      className="animate-pulse"
      transform={`translate(${particle.x} ${particle.y}) scale(${particle.size / 2})`}
      opacity={0.55 + speedProgress * 0.35}
    >
      {characterId === "white-fox-ice-mage" && (
        <path d="M1 0h2v1h1v2H3v1H1V3H0V1h1z" fill={theme.highlight} />
      )}
      {characterId === "purple-rabbit-ninja" && (
        <path d="m2 0 .6 1.4L4 2l-1.4.6L2 4l-.6-1.4L0 2l1.4-.6z" fill={theme.highlight} />
      )}
      {characterId === "swamp-frog-mage" && (
        <g fill="none" stroke={theme.highlight} strokeWidth="1">
          <circle cx="2" cy="2" r="1.6" />
          <path d="M2 0v1" />
        </g>
      )}
      {characterId === "forge-raccoon-mage" && (
        <path d="M1 4V2h1V0h1v2h1v2H3v1H2V4z" fill={theme.highlight} />
      )}
      {characterId === "time-owl-mage" && (
        <path d="M1 0h2v1h1v1H3v2H2V2H0V1h1z" fill={theme.highlight} />
      )}
    </g>
  );
}

export function PlayerMagicCloud({
  characterId,
  speedProgress,
}: {
  characterId: PlayableCharacterId;
  speedProgress: number;
}) {
  const theme = MAGIC_CLOUD_THEMES[characterId];
  const trailCount = Math.ceil(speedProgress * CLOUD_SPEED_TRAIL_PARTICLES.length);

  return (
    <svg
      className="pointer-events-none absolute left-1/2 top-[52px] z-0 h-7 w-[4.5rem] -translate-x-1/2"
      viewBox="0 0 72 28"
      shapeRendering="crispEdges"
      aria-hidden="true"
      data-cloud-theme={characterId}
      data-speed-trail-count={trailCount}
      style={{ filter: `drop-shadow(0 0 ${7 + speedProgress * 4}px ${theme.glow})` }}
    >
      <path
        d="M9 25v-3H5v-4h3v-4h4v-4h5V7h7V4h8V1h8v3h7V2h7v3h6v4h5v4h4v4h3v5h-5v4H11v-1z"
        fill={theme.outline}
      />
      <path
        d="M13 22v-3H9v-2h4v-4h4V9h6V6h7V4h7v3h7V5h6v3h6v4h5v4h4v3h-4v3h-5v2H14v-2z"
        fill={theme.body}
      />
      <path d="M14 21h46v2h-5v2H17v-2h-3z" fill={theme.underside} />
      <rect x="19" y="10" width="10" height="2" fill={theme.highlight} />
      <rect x="28" y="7" width="8" height="2" fill={theme.highlight} />
      <rect x="46" y="8" width="7" height="2" fill={theme.highlight} />
      {CLOUD_SPEED_TRAIL_PARTICLES.slice(0, trailCount).map((particle, index) => (
        <PlayerMagicCloudSpeedParticle
          key={`${characterId}-speed-trail-${index}`}
          characterId={characterId}
          particle={particle}
          theme={theme}
          speedProgress={speedProgress}
        />
      ))}
      <PlayerMagicCloudDetails characterId={characterId} />
    </svg>
  );
}

export interface GameOverBurstState {
  x: number;
  y: number;
  id: number;
}

export function PlayerGameOverBurst({
  characterId,
  x,
  y,
  id,
  onComplete,
}: GameOverBurstState & {
  characterId: PlayableCharacterId;
  onComplete: (id: number) => void;
}) {
  const theme = MAGIC_CLOUD_THEMES[characterId];

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
        className="h-14 w-14 animate-ping"
        viewBox="0 0 64 64"
        shapeRendering="crispEdges"
        aria-hidden="true"
        data-burst-theme={characterId}
        onAnimationEnd={() => onComplete(id)}
        style={{
          filter: `drop-shadow(0 0 8px ${theme.glow})`,
          animationDuration: `${C.gameOverBurstDurationMs}ms`,
          animationIterationCount: 1,
        }}
      >
        <path d="M29 2h6v5h-6zM57 29h5v6h-5zM29 57h6v5h-6zM2 29h5v6H2z" fill={theme.highlight} />
        {characterId === "white-fox-ice-mage" && (
          <g fill="#c9f4ff">
            <path d="m17 12 6-10 6 14h-5v8h-4v-8zM39 40l5-10 5 13h-4v8h-4v-8zM9 34l4-7 4 9h-3v5h-3v-5z" />
            <path d="m45 12 2-5 3 6h-2v4h-2v-4z" fill="#fff" />
          </g>
        )}
        {characterId === "purple-rabbit-ninja" && (
          <g fill="#d7c2ff">
            <path d="m13 14 7 3 7-5-3 8 5 7-9-2-5 7-1-9-8-4 9-1zM43 40l6 2 6-4-2 7 4 5-8-1-4 6-1-7-6-3 7-1z" />
            <path d="m40 11 2-5 2 5 5 2-5 2-2 5-2-5-5-2z" fill="#f0e6ff" />
          </g>
        )}
        {characterId === "swamp-frog-mage" && (
          <g fill="#b8ec9a">
            <path d="M12 18h5v5h5v4h-5v-2h-5zM43 38h5v5h5v4h-5v-2h-5z" />
            <circle cx="46" cy="16" r="4" fill="none" stroke="#d7ffe2" strokeWidth="2" />
            <circle cx="17" cy="44" r="3" fill="none" stroke="#d7ffe2" strokeWidth="2" />
          </g>
        )}
        {characterId === "forge-raccoon-mage" && (
          <g fill="#ffac55">
            <path d="M15 24v-8h4v-8h4v9h4v8h-4v5h-8zM39 50v-8h4v-8h4v9h4v8h-4v5h-8z" />
            <path d="M45 17h4v4h-4zM12 43h4v4h-4zM53 27h4v4h-4z" fill="#ffe295" />
          </g>
        )}
        {characterId === "time-owl-mage" && (
          <g fill="#d9ceff" stroke="#f0eaff" strokeWidth="1">
            <circle cx="47" cy="17" r="8" fill="#7168b8" />
            <path
              d="M47 11v6l4 2M17 43h3v4h3v3h-3v-2h-3zM18 12h2v4h3v2h-3v4h-2v-4h-3v-2h3z"
              fill="none"
            />
            <path d="M12 31h4v2h-4zM49 43h3v3h-3z" fill="none" />
          </g>
        )}
      </svg>
    </div>
  );
}

export function SkyFlapScreen({
  characterId: selectedCharacterId,
  playerName,
  primaryWalletId,
  onBack,
}: SkyFlapScreenProps) {
  const engineRef = useRef<SkyFlapEngine | null>(null);
  if (!engineRef.current) engineRef.current = new SkyFlapEngine();
  const engine = engineRef.current;
  const { playSfx } = useArcadeAudio();
  const characterId = selectedCharacterId ?? "white-fox-ice-mage";
  const character = getCharacterById(characterId);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const playerSpriteRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<HudState>(() => ({
    phase: engine.phase,
    score: engine.score,
    bestScore: engine.bestScore,
    distance: engine.scrollDistance,
  }));
  const [gameOverBurst, setGameOverBurst] = useState<GameOverBurstState | null>(null);
  const [matchId, setMatchId] = useState(() => createMatchId("sky-flap"));
  const previousPhaseRef = useRef<SkyFlapPhase>(engine.phase);
  const previousScoreRef = useRef(engine.score);
  const audioMatchIdRef = useRef(matchId);
  const audioBestAtStartRef = useRef(0);
  const audioRecordPlayedRef = useRef(false);
  const audioSnapshotRef = useRef<{
    phase: SkyFlapPhase;
    score: number;
    bestScore: number;
  } | null>(null);
  const scoreEffectStartedAtRef = useRef<number | null>(null);
  const entryStartedAtRef = useRef<number | null>(null);
  const rewardReceipts = useMatchCurrencyRewards(
    matchId,
    hud.phase === "gameover"
      ? [
          {
            walletId: primaryWalletId,
            playerId: "player-1",
            playerName,
            amount: getSkyFlapCoinReward(hud.score),
          },
        ]
      : [],
    primaryWalletId,
  );
  const speedMultiplier = getScrollSpeedMultiplier(hud.score);
  const speedProgress = Math.min(1, (speedMultiplier - 1) / (C.maxSpeedMultiplier - 1));

  useEffect(() => {
    engine.setBestScore(readBestScore());
    setHud({
      phase: engine.phase,
      score: engine.score,
      bestScore: engine.bestScore,
      distance: engine.scrollDistance,
    });
  }, [engine]);

  useEffect(() => {
    audioMatchIdRef.current = matchId;
    audioBestAtStartRef.current = engine.bestScore;
    audioRecordPlayedRef.current = false;
    audioSnapshotRef.current = {
      phase: engine.phase,
      score: engine.score,
      bestScore: engine.bestScore,
    };
  }, [engine, matchId]);

  useEffect(() => {
    const current = { phase: hud.phase, score: hud.score, bestScore: hud.bestScore };
    const previous = audioSnapshotRef.current;
    if (!previous || audioMatchIdRef.current !== matchId) {
      audioMatchIdRef.current = matchId;
      audioBestAtStartRef.current = current.bestScore;
      audioRecordPlayedRef.current = false;
      audioSnapshotRef.current = current;
      return;
    }

    if (previous.phase !== "playing" && current.phase === "playing") {
      playSfx("game-start");
    }
    const newRecord =
      current.phase === "playing" &&
      current.bestScore > audioBestAtStartRef.current &&
      !audioRecordPlayedRef.current;
    if (newRecord) {
      audioRecordPlayedRef.current = true;
      playSfx("record");
    } else if (current.phase === "playing" && current.score > previous.score) {
      playSfx("score");
    }
    if (previous.phase === "playing" && current.phase === "gameover") {
      playSfx("game-over");
    }

    audioSnapshotRef.current = current;
  }, [hud.bestScore, hud.phase, hud.score, matchId, playSfx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let frame = 0;
    let previous = performance.now();
    let lastHudKey = "";
    let savedBest = engine.bestScore;
    let submittedBest = savedBest;

    const loop = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - previous) / 1000));
      previous = now;
      engine.step(dt);
      const snapshot = engine.snapshot();

      if (entryStartedAtRef.current === null) entryStartedAtRef.current = now;
      const entryProgress = Math.min(
        1,
        (now - entryStartedAtRef.current) / C.entryEffectDurationMs,
      );

      if (snapshot.score > previousScoreRef.current) {
        scoreEffectStartedAtRef.current = now;
      } else if (snapshot.score < previousScoreRef.current) {
        scoreEffectStartedAtRef.current = null;
      }
      previousScoreRef.current = snapshot.score;

      if (snapshot.phase !== previousPhaseRef.current) {
        if (snapshot.phase === "gameover" && previousPhaseRef.current === "playing") {
          setGameOverBurst({ x: snapshot.playerX, y: snapshot.playerY, id: now });
        } else if (snapshot.phase === "ready") {
          setGameOverBurst(null);
        }
        previousPhaseRef.current = snapshot.phase;
      }

      const scoreEffectStartedAt = scoreEffectStartedAtRef.current;
      const scoreProgress =
        scoreEffectStartedAt === null
          ? 1
          : Math.min(1, (now - scoreEffectStartedAt) / C.scoreEffectDurationMs);
      drawSkyFlap(ctx, snapshot, now / 1000, { entryProgress, scoreProgress });

      const player = playerRef.current;
      if (player) {
        const angle = Math.max(-20, Math.min(34, snapshot.playerVelocityY * 0.045));
        const scale = 0.9 + entryProgress * 0.1;
        player.style.left = `${(snapshot.playerX / C.width) * 100}%`;
        player.style.top = `${(snapshot.playerY / C.height) * 100}%`;
        player.style.opacity = `${0.65 + entryProgress * 0.35}`;
        player.style.transform = `translate(-50%, -50%) scale(${scale})`;
        if (playerSpriteRef.current) {
          playerSpriteRef.current.style.transform = `rotate(${angle}deg)`;
        }
      }

      const hudKey = `${snapshot.phase}|${snapshot.score}|${snapshot.bestScore}`;
      if (hudKey !== lastHudKey) {
        lastHudKey = hudKey;
        setHud({
          phase: snapshot.phase,
          score: snapshot.score,
          bestScore: snapshot.bestScore,
          distance: snapshot.scrollDistance,
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
        void submitGlobalRecord("sky-flap", snapshot.bestScore);
      }

      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [engine]);

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
      const wasPlaying = engine.phase === "playing";
      if (engine.flap() && wasPlaying) playSfx("flap");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [engine, playSfx]);

  const handleCanvasPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const wasPlaying = engine.phase === "playing";
    if (engine.flap() && wasPlaying) playSfx("flap");
  };

  const restart = () => {
    engine.reset();
    setMatchId(createMatchId("sky-flap"));
    const snapshot = engine.snapshot();
    entryStartedAtRef.current = performance.now();
    previousPhaseRef.current = snapshot.phase;
    previousScoreRef.current = snapshot.score;
    scoreEffectStartedAtRef.current = null;
    setGameOverBurst(null);
    setHud({
      phase: snapshot.phase,
      score: snapshot.score,
      bestScore: snapshot.bestScore,
      distance: snapshot.scrollDistance,
    });
  };

  const completeGameOverBurst = (id: number) => {
    setGameOverBurst((current) => (current?.id === id ? null : current));
  };

  return (
    <main className="celestial-sky relative min-h-screen overflow-hidden px-3 py-4 text-foreground sm:px-6 sm:py-7">
      <PixelSceneDecor density="calm" />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-arcade text-[0.55rem] text-arcade-violet">MAGISTERIUM ARCADE</p>
            <h1 className="pixel-title text-2xl leading-relaxed text-arcade-ink sm:text-3xl">
              SKY FLAP
            </h1>
            <p className="mt-1 font-game text-base text-muted-foreground sm:text-lg">
              VOANDO COM {character?.shortName ?? "RAPOSA"}
            </p>
          </div>
          <Button type="button" variant="arcade" size="arcade" onClick={onBack}>
            VOLTAR À MODALIDADE
          </Button>
        </header>

        <section className="pixel-panel rounded-sm p-3 sm:p-5" aria-label="Minigame Sky Flap">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-arcade text-[0.55rem] text-arcade-violet sm:text-xs">
              PORTAIS CELESTIAIS
            </p>
            <div
              className="flex items-center gap-3 border-2 border-arcade-panel-border bg-arcade-sky/45 px-3 py-2 font-arcade text-[0.5rem] text-arcade-ink sm:text-[0.62rem]"
              aria-live="polite"
              aria-label={`Pontos ${hud.score}, moedas ${getSkyFlapCoinReward(hud.score)}, melhor ${hud.bestScore}`}
            >
              <span>PONTOS: {hud.score}</span>
              <span className="text-arcade-gold">🪙 {getSkyFlapCoinReward(hud.score)}</span>
              <span className="text-arcade-violet">MELHOR: {hud.bestScore}</span>
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
              aria-label="Sky Flap: pressione espaço ou clique para voar"
            />
            <div
              ref={playerRef}
              className="pointer-events-none absolute z-10 h-16 w-16"
              style={{
                left: `${(C.playerX / C.width) * 100}%`,
                top: "50%",
                transform: "translate(-50%, -50%)",
              }}
              aria-hidden="true"
            >
              {hud.phase !== "gameover" && (
                <PlayerMagicCloud characterId={characterId} speedProgress={speedProgress} />
              )}
              <div
                ref={playerSpriteRef}
                className="absolute inset-0 z-10 flex items-center justify-center"
              >
                <span className="absolute h-11 w-11 bg-arcade-cyan/20 shadow-[0_0_20px_var(--color-arcade-cyan)]" />
                <GameplaySprite
                  characterId={characterId}
                  animation={hud.phase === "gameover" ? "hurt" : "jump"}
                  size={48}
                  className="relative drop-shadow-[0_0_7px_rgba(210,250,255,0.85)] [image-rendering:pixelated]"
                />
              </div>
            </div>

            {hud.phase === "ready" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-arcade-ink/15 p-3">
                <div className="border-2 border-arcade-cloud bg-arcade-panel/95 px-4 py-3 text-center shadow-[5px_5px_0_var(--color-arcade-shadow)] sm:px-7 sm:py-5">
                  <p className="font-arcade text-[0.55rem] text-arcade-violet sm:text-sm">
                    PRESSIONE ESPAÇO PARA VOAR
                  </p>
                  <p className="mt-2 font-game text-base text-arcade-ink sm:text-xl">
                    ou clique para dar um impulso
                  </p>
                </div>
              </div>
            )}

            {hud.phase === "gameover" && (
              <div className="absolute inset-0 flex items-center justify-center bg-arcade-ink/65 p-3">
                {gameOverBurst && (
                  <PlayerGameOverBurst
                    {...gameOverBurst}
                    characterId={characterId}
                    onComplete={completeGameOverBurst}
                  />
                )}
                <div className="pixel-panel relative z-10 w-full max-w-sm rounded-sm p-4 text-center sm:p-6">
                  <p className="font-arcade text-sm text-arcade-violet sm:text-lg">GAME OVER</p>
                  <p className="mt-4 font-arcade text-[0.6rem] text-arcade-ink sm:text-xs">
                    PONTOS: {hud.score}
                  </p>
                  <p className="mt-2 font-arcade text-[0.55rem] text-arcade-ink sm:text-xs">
                    DISTÂNCIA: {Math.floor(hud.distance).toLocaleString("pt-BR")}
                  </p>
                  <p className="mt-2 font-arcade text-[0.55rem] text-arcade-cyan sm:text-[0.65rem]">
                    MELHOR: {hud.bestScore}
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
            ESPAÇO ou CLIQUE = impulso para cima · mantenha o voo entre os portais
          </p>
        </section>
      </div>
    </main>
  );
}
