import { Button } from "@/components/ui/button";

import { PixelSceneDecor } from "./PixelSceneDecor";
import { supportsMinigameMode } from "../data/gameModes";
import type { ArcadeMinigameId } from "../types";

const GAME_COPY: Record<ArcadeMinigameId, { title: string; intro: string; multiplayer: string }> = {
  "sky-flap": {
    title: "SKY FLAP",
    intro: "Prepare suas asas para atravessar os portais celestiais.",
    multiplayer: "Compita no mesmo percurso mágico, contra bots ou com amigos.",
  },
  "sky-run": {
    title: "SKY RUN",
    intro: "Corra por mundos encantados e desvie dos obstáculos mágicos.",
    multiplayer: "Corra no mesmo percurso, contra bots ou com amigos.",
  },
  tower: {
    title: "TOWER",
    intro: "Construa sua torre e dispute a arena encantada.",
    multiplayer: "Escolha bots para enfrentar ou crie uma sala privada.",
  },
  "spellbound-maze": {
    title: "LABIRINTO MÁGICO",
    intro: "Explore labirintos celestes sem fim, reúna runas e escape dos espíritos.",
    multiplayer: "Corra por objetivos compartilhados e dispute quem alcança o portal primeiro.",
  },
};

const MODE_ACCENTS = {
  cyan: {
    ring: "focus-visible:ring-arcade-cyan",
    number: "text-arcade-cyan",
    border: "border-arcade-cyan",
    hover: "group-hover:bg-arcade-cyan/25",
  },
  violet: {
    ring: "focus-visible:ring-arcade-violet",
    number: "text-arcade-violet",
    border: "border-arcade-violet",
    hover: "group-hover:bg-arcade-violet/25",
  },
} as const;

export function GameModeSelectorScreen({
  gameId,
  onSingleplayer,
  onMultiplayer,
  onBack,
}: {
  gameId: ArcadeMinigameId;
  onSingleplayer?: () => void;
  onMultiplayer?: () => void;
  onBack: () => void;
}) {
  const copy = GAME_COPY[gameId];
  const modes = [
    supportsMinigameMode(gameId, "singleplayer") && onSingleplayer
      ? {
          key: "singleplayer",
          title: "SINGLEPLAYER",
          description: copy.intro,
          action: "JOGAR SOZINHO",
          onClick: onSingleplayer,
          accent: MODE_ACCENTS.cyan,
        }
      : null,
    supportsMinigameMode(gameId, "multiplayer") && onMultiplayer
      ? {
          key: "multiplayer",
          title: "MULTIPLAYER",
          description: copy.multiplayer,
          action: "ABRIR OPÇÕES",
          onClick: onMultiplayer,
          accent: MODE_ACCENTS.violet,
        }
      : null,
  ].filter((mode) => mode !== null);

  return (
    <main className="celestial-sky relative min-h-screen overflow-hidden px-4 py-5 text-foreground sm:px-6 sm:py-8">
      <PixelSceneDecor density="calm" />
      <div className="relative z-10 mx-auto flex min-h-[85vh] w-full max-w-5xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <p className="font-arcade text-[0.55rem] text-arcade-violet sm:text-xs">
            MAGISTERIUM ARCADE
          </p>
          <Button type="button" variant="arcade" size="arcade" onClick={onBack}>
            VOLTAR AO LOBBY
          </Button>
        </header>

        <section className="my-auto py-12 text-center">
          <p className="mb-3 font-arcade text-xs text-arcade-ink sm:text-sm">{copy.title}</p>
          <h1 className="pixel-title text-3xl leading-relaxed text-arcade-ink sm:text-5xl">
            ESCOLHA A MODALIDADE
          </h1>
          <p className="mx-auto mt-3 max-w-xl font-game text-lg text-muted-foreground sm:text-xl">
            {copy.intro}
          </p>

          <div
            className={`mx-auto mt-10 grid max-w-4xl gap-5 ${modes.length > 1 ? "sm:grid-cols-2" : "sm:max-w-xl"}`}
          >
            {modes.map((mode) => (
              <button
                key={mode.key}
                type="button"
                onClick={mode.onClick}
                className={`pixel-panel group flex min-h-60 flex-col items-center justify-center gap-4 rounded-sm border-2 border-arcade-panel-border bg-arcade-panel/90 p-6 text-center shadow-[6px_6px_0_var(--color-arcade-shadow)] transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 ${mode.accent.ring}`}
              >
                <span aria-hidden="true" className={`font-arcade text-4xl ${mode.accent.number}`}>
                  {mode.key === "singleplayer" ? "01" : "02"}
                </span>
                <span className="font-arcade text-xl text-arcade-ink sm:text-2xl">
                  {mode.title}
                </span>
                <span className="max-w-xs font-game text-lg text-muted-foreground">
                  {mode.description}
                </span>
                <span
                  className={`mt-1 border-2 ${mode.accent.border} bg-arcade-sky/60 px-5 py-2 font-arcade text-[0.6rem] text-arcade-ink transition-colors ${mode.accent.hover}`}
                >
                  {mode.action}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
