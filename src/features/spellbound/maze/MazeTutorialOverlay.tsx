import { LOCAL_PLAYER_CONTROLS } from "./config";
import type { MazeMode } from "./types";

export type MazeTutorialFocus = "mission" | "controls" | "gems" | "exit";

export const MAZE_TUTORIAL_FOCUS_BY_STEP: readonly MazeTutorialFocus[] = [
  "mission",
  "controls",
  "gems",
  "exit",
];

const TUTORIAL_STEPS = [
  {
    eyebrow: "ETAPA 1 DE 4 · OBJETIVO",
    title: "EXPLORE O LABIRINTO MÁGICO",
    description:
      "Reúna todas as gemas azuis e os demais itens obrigatórios para liberar o portal. As moedas são bônus.",
  },
  {
    eyebrow: "ETAPA 2 DE 4 · MOVIMENTO",
    title: "ESCOLHA SEU CAMINHO",
    description:
      "Use os comandos indicados para o seu modo. O painel CONTROLES também mostra as teclas de poder e troca de personagem.",
  },
  {
    eyebrow: "ETAPA 3 DE 4 · GEMAS AZUIS",
    title: "ACOMPANHE SUA MISSÃO",
    description:
      "Cada cristal azul conta como uma gema. O contador destacado mostra quantas você coletou e quantas existem neste nível; runas e moedas têm contagens separadas.",
  },
  {
    eyebrow: "ETAPA 4 DE 4 · SAÍDA",
    title: "LIBERE O PORTAL E CONCLUA",
    description:
      "A saída só libera quando todos os itens que não são moedas forem coletados: cristais azuis, runas e runas de poder. Quando o painel indicar SAÍDA LIBERADA, caminhe até o portal.",
  },
] as const;

function LocalMovementControls({ playerCount }: { playerCount: number }) {
  const count = Math.max(1, Math.min(4, Math.floor(playerCount)));

  return (
    <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
      {Array.from({ length: count }, (_, index) => (
        <p
          key={index}
          className="flex items-center justify-between gap-2 border border-arcade-panel-border bg-arcade-sky/50 px-2 py-1.5 font-game text-sm text-arcade-ink"
        >
          <span className="font-arcade text-[0.42rem] text-arcade-violet">P{index + 1}</span>
          <span>{LOCAL_PLAYER_CONTROLS[index]?.movement ?? "—"}</span>
        </p>
      ))}
    </div>
  );
}

export function MazeTutorialOverlay({
  step,
  mode,
  playerCount,
  blueGemsTotal,
  onPrevious,
  onNext,
  onSkip,
  onComplete,
}: {
  step: number;
  mode: MazeMode;
  playerCount: number;
  blueGemsTotal: number;
  onPrevious: () => void;
  onNext: () => void;
  onSkip: () => void;
  onComplete: () => void;
}) {
  const currentStep = Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, Math.floor(step)));
  const content = TUTORIAL_STEPS[currentStep]!;
  const isLocalMultiplayer = mode === "local";

  return (
    <>
      <div
        className="pointer-events-auto absolute inset-0 z-30 bg-[#080d28]/65 backdrop-blur-[1px]"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-4">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="maze-tutorial-title"
          aria-describedby="maze-tutorial-description"
          className="pointer-events-auto my-auto max-h-[calc(100%_-_1rem)] w-full max-w-2xl overflow-y-auto rounded-sm border-[3px] border-arcade-cyan bg-[#e9f4ff]/[0.98] p-4 text-center text-arcade-ink shadow-[6px_6px_0_var(--color-arcade-shadow)] transition duration-200 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 sm:p-5"
        >
          <div
            key={currentStep}
            className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2"
            aria-live="polite"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-arcade text-[0.46rem] text-arcade-violet sm:text-[0.52rem]">
                {content.eyebrow}
              </p>
              <span className="shrink-0 font-arcade text-[0.42rem] text-arcade-violet">
                {currentStep + 1}/{TUTORIAL_STEPS.length}
              </span>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden border border-arcade-panel-border bg-[#101537]/15"
              role="progressbar"
              aria-label="Progresso do tutorial"
              aria-valuemin={1}
              aria-valuemax={TUTORIAL_STEPS.length}
              aria-valuenow={currentStep + 1}
            >
              <div
                className="h-full bg-arcade-cyan transition-[width] duration-200"
                style={{ width: `${((currentStep + 1) / TUTORIAL_STEPS.length) * 100}%` }}
              />
            </div>
            <h2
              id="maze-tutorial-title"
              className="pixel-title mt-4 text-xl leading-relaxed text-arcade-ink sm:text-2xl"
            >
              {content.title}
            </h2>
            <p
              id="maze-tutorial-description"
              className="mx-auto mt-2 max-w-xl font-game text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              {currentStep === 2 && blueGemsTotal > 0
                ? `${content.description} Neste nível, há ${blueGemsTotal} gemas azuis.`
                : content.description}
            </p>

            {currentStep === 1 && (
              <div className="mx-auto mt-2 max-w-xl rounded-sm border border-arcade-panel-border bg-arcade-sky/35 p-2 text-left">
                {isLocalMultiplayer ? (
                  <>
                    <p className="font-arcade text-[0.42rem] text-arcade-violet">
                      MOVIMENTO · MULTIPLAYER LOCAL
                    </p>
                    <LocalMovementControls playerCount={playerCount} />
                  </>
                ) : (
                  <p className="font-game text-sm text-arcade-ink sm:text-base">
                    <span className="font-arcade text-[0.42rem] text-arcade-violet">
                      SOLO E BOTS:
                    </span>{" "}
                    use as setas ou W A S D para mover.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 border-t border-arcade-panel-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={onSkip}
              className="border border-arcade-panel-border bg-arcade-sky/50 px-3 py-2 font-arcade text-[0.44rem] text-arcade-violet transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-arcade-cyan"
            >
              PULAR TUTORIAL
            </button>
            <div className="flex justify-center gap-2 sm:justify-end">
              <button
                type="button"
                disabled={currentStep === 0}
                onClick={onPrevious}
                className="border-2 border-arcade-panel-border bg-arcade-sky/60 px-3 py-2 font-arcade text-[0.46rem] text-arcade-ink transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-arcade-cyan disabled:cursor-not-allowed disabled:opacity-45"
              >
                VOLTAR
              </button>
              {currentStep < TUTORIAL_STEPS.length - 1 ? (
                <button
                  type="button"
                  autoFocus={currentStep === 0}
                  onClick={onNext}
                  className="border-2 border-arcade-violet bg-arcade-violet/75 px-4 py-2 font-arcade text-[0.46rem] text-arcade-ink transition-colors hover:bg-arcade-cyan focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-arcade-cyan"
                >
                  AVANÇAR
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onComplete}
                  className="border-2 border-arcade-violet bg-arcade-violet/75 px-4 py-2 font-arcade text-[0.46rem] text-arcade-ink transition-colors hover:bg-arcade-cyan focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-arcade-cyan"
                >
                  CONCLUIR
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
