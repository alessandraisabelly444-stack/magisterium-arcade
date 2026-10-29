import { Button } from "@/components/ui/button";

import { PixelSceneDecor } from "./PixelSceneDecor";
import { supportsMinigameMode } from "../data/gameModes";
import type { ArcadeMinigameId } from "../types";

const GAME_LABELS: Record<ArcadeMinigameId, string> = {
  "sky-flap": "SKY FLAP",
  "sky-run": "SKY RUN",
  tower: "TOWER",
  "spellbound-maze": "LABIRINTO MÁGICO",
};

const CARD_ACCENTS = {
  cyan: {
    ring: "focus-visible:ring-arcade-cyan",
    index: "text-arcade-cyan",
    border: "border-arcade-cyan",
    hover: "group-hover:bg-arcade-cyan/25",
  },
  violet: {
    ring: "focus-visible:ring-arcade-violet",
    index: "text-arcade-violet",
    border: "border-arcade-violet",
    hover: "group-hover:bg-arcade-violet/25",
  },
  gold: {
    ring: "focus-visible:ring-arcade-gold",
    index: "text-arcade-gold",
    border: "border-arcade-gold",
    hover: "group-hover:bg-arcade-gold/25",
  },
} as const;

interface MultiplayerActionMenuScreenProps {
  gameId: ArcadeMinigameId;
  roomsReady?: boolean;
  onBots: () => void;
  onLocal?: () => void;
  onCreateRoom?: () => void;
  onJoinRoom?: () => void;
  onBack: () => void;
}

export function MultiplayerActionMenuScreen({
  gameId,
  roomsReady = false,
  onBots,
  onLocal,
  onCreateRoom,
  onJoinRoom,
  onBack,
}: MultiplayerActionMenuScreenProps) {
  const cards = [
    supportsMinigameMode(gameId, "bots")
      ? {
          key: "bots",
          number: "01",
          title: "JOGAR COM BOTS",
          description:
            "Enfrente adversários de IA com personagem, comportamento e pontuação próprios.",
          action: "COMEÇAR PARTIDA",
          onClick: onBots,
          disabled: false,
          accent: CARD_ACCENTS.cyan,
        }
      : null,
    onLocal
      ? {
          key: "local",
          number: "02",
          title: "PARTIDA LOCAL",
          description: "Joguem no mesmo dispositivo com controles separados por participante.",
          action: "CONFIGURAR JOGADORES",
          onClick: onLocal,
          disabled: false,
          accent: CARD_ACCENTS.violet,
        }
      : null,
    supportsMinigameMode(gameId, "privateRoom")
      ? {
          key: "create",
          number: onLocal ? "03" : "02",
          title: "CRIAR SALA PRIVADA",
          description: "Abra uma sala e convide amigos usando um código curto.",
          action: roomsReady ? "CRIAR SALA" : "BACKEND PENDENTE",
          onClick: onCreateRoom ?? (() => undefined),
          disabled: !roomsReady || !onCreateRoom,
          accent: CARD_ACCENTS.violet,
        }
      : null,
    supportsMinigameMode(gameId, "privateRoom")
      ? {
          key: "join",
          number: onLocal ? "04" : "03",
          title: "ENTRAR EM SALA",
          description: "Digite o código do anfitrião para participar da partida.",
          action: roomsReady ? "DIGITAR CÓDIGO" : "BACKEND PENDENTE",
          onClick: onJoinRoom ?? (() => undefined),
          disabled: !roomsReady || !onJoinRoom,
          accent: CARD_ACCENTS.gold,
        }
      : null,
  ].filter((card) => card !== null);

  return (
    <main className="celestial-sky relative min-h-screen overflow-hidden px-4 py-5 text-foreground sm:px-6 sm:py-8">
      <PixelSceneDecor density="calm" />
      <div className="relative z-10 mx-auto flex min-h-[85vh] w-full max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="font-arcade text-[0.55rem] text-arcade-violet sm:text-xs">
              MAGISTERIUM ARCADE
            </p>
            <p className="mt-2 font-arcade text-xs text-arcade-ink sm:text-sm">
              {GAME_LABELS[gameId]}
            </p>
          </div>
          <Button type="button" variant="arcade" size="arcade" onClick={onBack}>
            VOLTAR
          </Button>
        </header>

        <section className="my-auto py-10 text-center">
          <h1 className="pixel-title text-3xl leading-relaxed text-arcade-ink sm:text-5xl">
            MULTIPLAYER
          </h1>
          <p className="mx-auto mt-3 max-w-2xl font-game text-lg text-muted-foreground sm:text-xl">
            Escolha como jogar. O percurso e as regras continuam próprios deste minigame.
          </p>

          <div className="mx-auto mt-8 grid max-w-5xl gap-4 sm:grid-cols-2">
            {cards.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={card.onClick}
                disabled={card.disabled}
                className={`pixel-panel group flex min-h-52 flex-col items-center justify-center gap-3 rounded-sm border-2 border-arcade-panel-border bg-arcade-panel/90 p-5 text-center shadow-[6px_6px_0_var(--color-arcade-shadow)] transition-transform enabled:hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 ${card.accent.ring} disabled:cursor-not-allowed disabled:opacity-55`}
              >
                <span aria-hidden="true" className={`font-arcade text-3xl ${card.accent.index}`}>
                  {card.number}
                </span>
                <span className="font-arcade text-lg text-arcade-ink sm:text-xl">{card.title}</span>
                <span className="max-w-sm font-game text-base text-muted-foreground">
                  {card.description}
                </span>
                <span
                  className={`mt-1 border-2 ${card.accent.border} bg-arcade-sky/60 px-4 py-2 font-arcade text-[0.55rem] text-arcade-ink transition-colors ${card.accent.hover}`}
                >
                  {card.action}
                </span>
              </button>
            ))}
          </div>

          {!roomsReady && supportsMinigameMode(gameId, "privateRoom") && (
            <p className="mx-auto mt-5 max-w-2xl border border-arcade-panel-border bg-arcade-panel/75 px-3 py-2 font-game text-sm text-muted-foreground">
              Salas privadas entre dispositivos dependem de um backend persistente e ainda não estão
              configuradas.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
