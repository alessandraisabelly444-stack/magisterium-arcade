import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { CurrencyRewardCard } from "../components/CurrencyRewardCard";
import { PixelSceneDecor } from "../components/PixelSceneDecor";
import { createMatchId, useMatchCurrencyRewards, walletIdForLocalSlot } from "../currency";
import { useArcadeAudio } from "../audio/ArcadeAudioProvider";
import { submitGlobalRecord } from "../leaderboard/api";
import { TOWER_CONFIG as C } from "./config";
import { calculateTowerRewardBreakdown } from "./rewards";
import { TETROMINO_SHAPES } from "./pieces";
import { TowerEngine, type TowerSnapshot } from "./engine";
import { renderPiecePreview, renderTower } from "./render";
import { WinCountdown } from "./WinCountdown";

const BEST_HEIGHT_KEY = "spellbound-tower-best-height-tenths-v1";

type PlayerIndex = 0 | 1;
type SnapshotPair = [TowerSnapshot | null, TowerSnapshot | null];

const DUEL_CONTROLS = [
  {
    left: "KeyA",
    right: "KeyD",
    rotate: "KeyW",
    softDrop: "KeyS",
    hardDrop: "Space",
    label: "A / D mover · W girar · S acelerar · ESPAÇO soltar",
  },
  {
    left: "ArrowLeft",
    right: "ArrowRight",
    rotate: "ArrowUp",
    softDrop: "ArrowDown",
    hardDrop: "Enter",
    label: "← / → mover · ↑ girar · ↓ acelerar · ENTER soltar",
  },
] as const;

const DUEL_KEY_BINDINGS: Record<
  string,
  { playerIndex: PlayerIndex; action: "left" | "right" | "rotate" | "softDrop" | "hardDrop" }
> = {
  KeyA: { playerIndex: 0, action: "left" },
  KeyD: { playerIndex: 0, action: "right" },
  KeyW: { playerIndex: 0, action: "rotate" },
  KeyS: { playerIndex: 0, action: "softDrop" },
  Space: { playerIndex: 0, action: "hardDrop" },
  ArrowLeft: { playerIndex: 1, action: "left" },
  ArrowRight: { playerIndex: 1, action: "right" },
  ArrowUp: { playerIndex: 1, action: "rotate" },
  ArrowDown: { playerIndex: 1, action: "softDrop" },
  Enter: { playerIndex: 1, action: "hardDrop" },
};

interface TowerLocalScreenProps {
  playerName: string;
  primaryWalletId: string;
  onBack: () => void;
  onChangeGame: () => void;
}

function playerStatusLabel(snapshot: TowerSnapshot | null) {
  if (snapshot?.status === "won") return "META ALCANÇADA";
  if (snapshot?.status === "lost") return "ELIMINADO";
  return "JOGANDO";
}

function readSavedBestHeight() {
  try {
    const value = Number(window.localStorage.getItem(BEST_HEIGHT_KEY));
    return Number.isSafeInteger(value) ? Math.max(0, value) : 0;
  } catch {
    return 0;
  }
}

export function TowerLocalScreen({
  playerName,
  primaryWalletId,
  onBack,
  onChangeGame,
}: TowerLocalScreenProps) {
  const { playSfx } = useArcadeAudio();
  const [stage, setStage] = useState<"setup" | "match">("setup");
  const [playerTwoName, setPlayerTwoName] = useState("JOGADOR 2");
  const [round, setRound] = useState(0);
  const [snapshots, setSnapshots] = useState<SnapshotPair>([null, null]);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const previewRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const enginesRef = useRef<(TowerEngine | null)[]>([null, null]);
  const peaksRef = useRef<[number, number]>([0, 0]);
  const finishTimesRef = useRef<[number | null, number | null]>([null, null]);
  const finishedPlayersRef = useRef(new Set<number>());
  const previousAudioSnapshotsRef = useRef<SnapshotPair>([null, null]);
  const matchSessionIdRef = useRef(createMatchId("tower-local"));
  const submittedRecordRef = useRef<string | null>(null);

  const names = [playerName.trim() || "JOGADOR 1", playerTwoName.trim() || "JOGADOR 2"];
  const matchId = `${matchSessionIdRef.current}:${round}`;
  const matchOver = snapshots.every(
    (snapshot) => snapshot !== null && snapshot.status !== "playing",
  );
  const winnerIndex: PlayerIndex | null = (() => {
    if (!matchOver) return null;
    const [first, second] = snapshots;
    if (!first || !second) return null;
    if (first.status === "won" && second.status !== "won") return 0;
    if (second.status === "won" && first.status !== "won") return 1;
    if (first.status === "won" && second.status === "won") {
      const firstTime = finishTimesRef.current[0];
      const secondTime = finishTimesRef.current[1];
      if (firstTime !== null && secondTime !== null && firstTime !== secondTime) {
        return firstTime < secondTime ? 0 : 1;
      }
    }
    const firstPeak = peaksRef.current[0];
    const secondPeak = peaksRef.current[1];
    if (firstPeak !== secondPeak) return firstPeak > secondPeak ? 0 : 1;
    if (first.stablePieces !== second.stablePieces) {
      return first.stablePieces > second.stablePieces ? 0 : 1;
    }
    return null;
  })();

  const rewardEntries = matchOver
    ? snapshots.flatMap((snapshot, index) => {
        if (!snapshot) return [];
        const reward = calculateTowerRewardBreakdown({
          status: snapshot.status,
          peakHeightTenths: peaksRef.current[index as PlayerIndex],
          stablePieces: snapshot.stablePieces,
        });
        return [
          {
            walletId: index === 0 ? primaryWalletId : walletIdForLocalSlot(1),
            playerId: index === 0 ? "player-1" : "player-2",
            playerName: names[index]!,
            amount: reward.total,
          },
        ];
      })
    : [];
  const rewardReceipts = useMatchCurrencyRewards(matchId, rewardEntries, primaryWalletId);

  useEffect(() => {
    if (stage !== "match") return;
    const engines: [TowerEngine, TowerEngine] = [new TowerEngine(), new TowerEngine()];
    enginesRef.current = engines;
    peaksRef.current = [0, 0];
    finishTimesRef.current = [null, null];
    finishedPlayersRef.current.clear();
    previousAudioSnapshotsRef.current = [null, null];
    submittedRecordRef.current = null;
    setSnapshots([null, null]);

    const contexts = engines.map((_, index) => canvasRefs.current[index]?.getContext("2d") ?? null);
    const lastKeys = ["", ""];
    let lastFrame = performance.now();
    let elapsed = 0;
    let animationFrame = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.033, Math.max(0, (now - lastFrame) / 1000));
      lastFrame = now;
      elapsed += dt;

      engines.forEach((engine, index) => {
        if (engine.status === "playing") engine.step(dt);
        const snapshot = engine.snapshot();
        const playerIndex = index as PlayerIndex;
        peaksRef.current[playerIndex] = Math.max(
          peaksRef.current[playerIndex],
          Math.max(0, Math.round(snapshot.heightMeters * 10)),
        );

        if (snapshot.status === "won" && !finishedPlayersRef.current.has(index)) {
          finishedPlayersRef.current.add(index);
          finishTimesRef.current[playerIndex] = now;
        }

        const context = contexts[index];
        if (context) renderTower(context, engine, elapsed, { showLandingGuide: true });

        const key = `${snapshot.status}|${snapshot.heightMeters}|${snapshot.lostPieces}|${snapshot.nextType}|${snapshot.placed}|${snapshot.stablePieces}|${snapshot.winConfirming}|${Math.ceil(snapshot.winSecondsRemaining)}`;
        if (key !== lastKeys[index]) {
          lastKeys[index] = key;
          setSnapshots((current) => {
            const next: SnapshotPair = [...current];
            next[playerIndex] = snapshot;
            return next;
          });
        }
      });

      animationFrame = requestAnimationFrame(loop);
    };

    animationFrame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animationFrame);
      engines.forEach((engine) => engine.destroy());
      enginesRef.current = [null, null];
    };
  }, [round, stage]);

  useEffect(() => {
    snapshots.forEach((snapshot, index) => {
      const context = previewRefs.current[index]?.getContext("2d");
      if (context && snapshot) {
        renderPiecePreview(context, snapshot.nextType, TETROMINO_SHAPES[snapshot.nextType]);
      }
    });
  }, [snapshots]);

  useEffect(() => {
    if (stage !== "match") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName))
      ) {
        return;
      }

      const binding = DUEL_KEY_BINDINGS[event.code];
      if (!binding) return;
      const engine = enginesRef.current[binding.playerIndex];
      if (!engine) return;

      const isArrowOrSpace = event.code.startsWith("Arrow") || event.code === "Space";
      if (isArrowOrSpace) event.preventDefault();
      if (engine.status !== "playing") return;

      if (binding.action === "left") engine.move(-1);
      else if (binding.action === "right") engine.move(1);
      else if (binding.action === "rotate" && !event.repeat) engine.rotate();
      else if (binding.action === "softDrop") engine.softDrop = true;
      else if (binding.action === "hardDrop" && !event.repeat) engine.hardDrop();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      for (let index = 0; index < DUEL_CONTROLS.length; index += 1) {
        if (event.code === DUEL_CONTROLS[index]!.softDrop) {
          const engine = enginesRef.current[index];
          if (engine) engine.softDrop = false;
        }
      }
    };
    const onBlur = () =>
      enginesRef.current.forEach((engine) => engine && (engine.softDrop = false));

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [stage, round]);

  useEffect(() => {
    let started = false;
    let pieceDropped = false;
    let pieceLost = false;
    let playerWon = false;
    let playerLost = false;
    const previous = previousAudioSnapshotsRef.current;

    snapshots.forEach((snapshot, index) => {
      if (!snapshot) return;
      const old = previous[index];
      if (!old) {
        if (index === 0 && snapshot.status === "playing") started = true;
        return;
      }
      if (snapshot.placed > old.placed) pieceDropped = true;
      if (snapshot.lostPieces > old.lostPieces) pieceLost = true;
      if (old.status === "playing" && snapshot.status === "won") playerWon = true;
      if (old.status === "playing" && snapshot.status === "lost") playerLost = true;
    });

    if (started) playSfx("game-start");
    else if (playerWon) playSfx("win");
    else if (playerLost) playSfx("game-over");
    else if (pieceLost) playSfx("hit");
    else if (pieceDropped) playSfx("piece-drop");
    previousAudioSnapshotsRef.current = snapshots;
  }, [playSfx, snapshots]);

  useEffect(() => {
    if (!matchOver) return;
    const bestTenths = peaksRef.current[0];
    if (bestTenths <= 0) return;
    const submissionKey = `${matchId}:${bestTenths}`;
    if (submittedRecordRef.current === submissionKey) return;
    submittedRecordRef.current = submissionKey;
    if (bestTenths <= readSavedBestHeight()) return;
    try {
      window.localStorage.setItem(BEST_HEIGHT_KEY, String(bestTenths));
    } catch {
      // The local duel remains playable when browser storage is unavailable.
    }
    void submitGlobalRecord("tower", bestTenths);
  }, [matchId, matchOver]);

  const players = [
    { name: names[0]!, label: "P1", index: 0 as PlayerIndex },
    { name: names[1]!, label: "P2", index: 1 as PlayerIndex },
  ];

  const restart = () => {
    setSnapshots([null, null]);
    setRound((current) => current + 1);
  };

  return (
    <main className="celestial-sky relative min-h-screen overflow-hidden px-3 py-4 text-foreground sm:px-6">
      <PixelSceneDecor />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-arcade text-[0.55rem] text-arcade-violet">MAGISTERIUM ARCADE</p>
            <h1 className="pixel-title text-2xl leading-relaxed text-arcade-ink sm:text-3xl">
              TOWER <span className="text-arcade-cyan">PARTIDA LOCAL</span>
            </h1>
          </div>
          <Button type="button" variant="arcade" size="arcade" onClick={onBack}>
            VOLTAR ÀS OPÇÕES
          </Button>
        </header>

        {stage === "setup" ? (
          <section className="pixel-panel mx-auto w-full max-w-4xl rounded-sm p-4 sm:p-6">
            <p className="font-arcade text-[0.58rem] text-arcade-cyan sm:text-xs">
              DUELO LOCAL · DOIS TABULEIROS INDEPENDENTES
            </p>
            <h2 className="pixel-title mt-2 text-xl text-arcade-ink sm:text-2xl">
              CONSTRUA SUA TORRE MAIS ALTA
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <article className="border-2 border-arcade-cyan bg-arcade-sky/45 p-3 sm:p-4">
                <p className="font-arcade text-xs text-arcade-cyan">
                  P1 · {names[0]!.toUpperCase()}
                </p>
                <p className="mt-3 font-game text-base text-muted-foreground">
                  {DUEL_CONTROLS[0].label}
                </p>
              </article>
              <article className="border-2 border-arcade-violet bg-arcade-sky/45 p-3 sm:p-4">
                <label className="block font-arcade text-xs text-arcade-violet">
                  NOME DO P2
                  <input
                    type="text"
                    value={playerTwoName}
                    maxLength={18}
                    autoComplete="off"
                    onChange={(event) => setPlayerTwoName(event.target.value)}
                    className="mt-2 w-full border-2 border-arcade-panel-border bg-arcade-panel/80 px-3 py-2 font-game text-lg text-arcade-ink outline-none focus-visible:ring-2 focus-visible:ring-arcade-violet"
                    aria-label="Nome do jogador 2"
                  />
                </label>
                <p className="mt-3 font-game text-base text-muted-foreground">
                  {DUEL_CONTROLS[1].label}
                </p>
              </article>
            </div>
            <p className="mt-4 border border-arcade-panel-border bg-arcade-sky/35 px-3 py-2 font-game text-sm text-muted-foreground">
              Cada jogador tem seu próprio tabuleiro e compete pelas mesmas regras. Os poderes de
              personagem continuam disponíveis na partida Tower contra bots.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Button
                type="button"
                variant="arcade"
                size="arcade"
                onClick={() => setStage("match")}
              >
                COMEÇAR PARTIDA
              </Button>
              <Button type="button" variant="arcadePanel" size="arcade" onClick={onBack}>
                VOLTAR
              </Button>
            </div>
          </section>
        ) : (
          <>
            <section
              className="grid gap-4 xl:grid-cols-2"
              aria-label="Tabuleiros independentes do Tower"
            >
              {players.map((player) => {
                const snapshot = snapshots[player.index];
                const height = snapshot?.heightMeters ?? 0;
                const progress = Math.min(1, height / C.goalMeters);
                const status = snapshot?.status ?? "playing";
                const otherIndex = player.index === 0 ? 1 : 0;
                const waitingForOther = status !== "playing" && !matchOver;
                const boardClasses =
                  status === "won"
                    ? "ring-4 ring-arcade-cyan"
                    : status === "lost"
                      ? "opacity-75"
                      : player.index === 0
                        ? "border-arcade-cyan"
                        : "border-arcade-violet";

                return (
                  <article
                    key={player.label}
                    className={`pixel-panel min-w-0 rounded-sm border-2 p-3 ${boardClasses}`}
                    aria-label={`Tabuleiro de ${player.label}, ${player.name}`}
                  >
                    <header className="mb-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-arcade text-[0.58rem] text-arcade-ink">
                          {player.label} · {player.name.toUpperCase()}
                        </p>
                        <p className="mt-1 font-arcade text-[0.43rem] text-arcade-violet">
                          {height.toFixed(1)} / {C.goalMeters} m · {snapshot?.lostPieces ?? 0}/
                          {C.maxLostPieces} peças perdidas
                        </p>
                      </div>
                      <span className="shrink-0 border border-arcade-panel-border bg-arcade-sky/45 px-2 py-1 font-arcade text-[0.4rem] text-arcade-cyan">
                        {playerStatusLabel(snapshot)}
                      </span>
                    </header>

                    <div className="relative mx-auto w-full max-w-[360px]">
                      <canvas
                        ref={(element) => {
                          canvasRefs.current[player.index] = element;
                        }}
                        width={C.width}
                        height={C.height}
                        className="mx-auto block h-auto max-h-[58vh] w-full [image-rendering:pixelated]"
                        style={{ aspectRatio: `${C.width} / ${C.height}` }}
                        aria-label={`Tabuleiro ${player.label}; controles: ${DUEL_CONTROLS[player.index].label}`}
                      />
                      <WinCountdown snapshot={snapshot} />
                      {waitingForOther && (
                        <p
                          role="status"
                          className="absolute inset-x-2 top-1/2 -translate-y-1/2 border-2 border-arcade-panel-border bg-arcade-panel/95 px-2 py-2 text-center font-arcade text-[0.46rem] leading-relaxed text-arcade-violet"
                        >
                          {status === "won" ? "CHEGOU À META" : "TABULEIRO ELIMINADO"}
                          <br />
                          {players[otherIndex]!.label} CONTINUA A DISPUTA
                        </p>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <div>
                        <div className="h-3 border-2 border-arcade-panel-border bg-arcade-sky/30">
                          <div
                            className="h-full bg-gradient-to-r from-arcade-cyan to-arcade-lilac"
                            style={{ width: `${progress * 100}%` }}
                          />
                        </div>
                        <p className="mt-2 font-game text-xs text-muted-foreground">
                          {snapshot?.stablePieces ?? 0} peças estáveis · 🪙{" "}
                          {(snapshot?.stablePieces ?? 0) * 5}
                        </p>
                      </div>
                      <div className="border border-arcade-panel-border bg-arcade-sky/35 p-1 text-center">
                        <p className="font-arcade text-[0.4rem] text-arcade-violet">PRÓXIMA</p>
                        <canvas
                          ref={(element) => {
                            previewRefs.current[player.index] = element;
                          }}
                          width={110}
                          height={60}
                          className="mx-auto block"
                          aria-label={`Próxima peça de ${player.label}`}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            <section
              className="pixel-panel grid gap-3 rounded-sm p-3 sm:grid-cols-2"
              aria-label="Controles do duelo local"
            >
              {players.map((player) => (
                <p key={player.label} className="font-game text-sm text-muted-foreground">
                  <span className="font-arcade text-[0.46rem] text-arcade-violet">
                    {player.label}:{" "}
                  </span>
                  {DUEL_CONTROLS[player.index].label}
                </p>
              ))}
            </section>

            {matchOver && (
              <section className="pixel-panel mx-auto w-full max-w-3xl rounded-sm p-4 text-center sm:p-6">
                <p className="font-arcade text-[0.58rem] text-arcade-violet">FIM DO DUELO</p>
                <h2 className="pixel-title mt-2 text-xl text-arcade-ink sm:text-2xl">
                  {winnerIndex === null
                    ? "EMPATE!"
                    : `${names[winnerIndex]!.toUpperCase()} VENCEU!`}
                </h2>
                <ol className="mt-4 space-y-2 text-left">
                  {[0, 1]
                    .sort((left, right) => {
                      if (winnerIndex !== null) return left === winnerIndex ? -1 : 1;
                      const heightDifference = peaksRef.current[right]! - peaksRef.current[left]!;
                      if (heightDifference !== 0) return heightDifference;
                      return (
                        (snapshots[right]?.stablePieces ?? 0) - (snapshots[left]?.stablePieces ?? 0)
                      );
                    })
                    .map((index, place) => (
                      <li
                        key={index}
                        className={`flex items-center justify-between gap-2 border-2 px-3 py-2 font-arcade text-[0.5rem] ${index === winnerIndex ? "border-arcade-cyan bg-arcade-lilac/30" : "border-arcade-panel-border bg-arcade-sky/30"} text-arcade-ink`}
                      >
                        <span>
                          {winnerIndex === null ? "EMPATE" : place === 0 ? "1º" : "2º"} ·{" "}
                          {names[index]!.toUpperCase()}
                        </span>
                        <span>{(peaksRef.current[index as PlayerIndex] / 10).toFixed(1)} m</span>
                      </li>
                    ))}
                </ol>
                <CurrencyRewardCard receipts={rewardReceipts} />
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  <Button type="button" variant="arcade" size="arcade" onClick={restart}>
                    REVANCHE
                  </Button>
                  <Button type="button" variant="arcadePanel" size="arcade" onClick={onChangeGame}>
                    MUDAR DE JOGO
                  </Button>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
