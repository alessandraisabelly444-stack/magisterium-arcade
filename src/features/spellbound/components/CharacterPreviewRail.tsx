import { cn } from "@/lib/utils";

import { playableCharacterSeeds } from "../data/characters";
import type { PlayableCharacterId } from "../types";

interface CharacterPreviewRailProps {
  selectedId: PlayableCharacterId | null;
  unlockedCharacterIds: PlayableCharacterId[];
  onOpen: () => void;
}

export function CharacterPreviewRail({
  selectedId,
  unlockedCharacterIds,
  onOpen,
}: CharacterPreviewRailProps) {
  return (
    <section className="pixel-panel rounded-sm p-4" aria-label="Personagens jogáveis">
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h2 className="truncate font-arcade text-xs text-arcade-violet sm:text-sm">PERSONAGENS</h2>
        <button
          type="button"
          onClick={onOpen}
          className="shrink-0 font-arcade text-[0.55rem] text-arcade-cyan hover:underline"
        >
          VER TODOS
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {playableCharacterSeeds.map((character) => {
          const isUnlocked =
            !character.coinCost || unlockedCharacterIds.includes(character.id);
          return (
          <button
            type="button"
            onClick={onOpen}
            key={character.id}
            aria-label={
              isUnlocked
                ? `${character.name}, personagem desbloqueado`
                : `${character.name}, bloqueado por ${character.coinCost} moedas`
            }
            className={cn(
              "border-2 border-arcade-panel-border bg-arcade-sky/35 p-2 transition-transform hover:-translate-y-1",
              character.id === selectedId && "ring-4 ring-arcade-cyan",
              !isUnlocked && "border-arcade-gold/70",
            )}
          >
            <img
              src={character.sprite}
              alt={character.name}
              width={816}
              height={816}
              loading="lazy"
              className="mx-auto mb-2 h-16 w-16 object-contain [image-rendering:pixelated]"
            />
            <h3 className="text-center font-arcade text-[0.5rem] leading-relaxed text-foreground">
              {character.shortName}
            </h3>
            <p className="mt-1 text-center text-sm leading-tight text-muted-foreground">
              {character.theme}
            </p>
            {!isUnlocked && (
              <p className="mt-1 text-center font-arcade text-[0.38rem] text-arcade-gold">
                🔒 {character.coinCost?.toLocaleString("pt-BR")} 🪙
              </p>
            )}
          </button>
          );
        })}
      </div>
    </section>
  );
}
