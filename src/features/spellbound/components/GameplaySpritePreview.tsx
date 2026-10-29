import { useState } from "react";

import { cn } from "@/lib/utils";

import { GameplaySprite } from "../gameplay/sprites/GameplaySprite";
import { BASIC_ANIMATION_STATES, type AnimationState } from "../gameplay/sprites/types";
import type { PlayableCharacterId } from "../types";

const LABELS: Record<AnimationState, string> = {
  idle: "PARADO",
  walk: "ANDAR",
  run: "CORRER",
  jump: "PULAR",
  hurt: "DANO",
  victory: "VITÓRIA",
  defeat: "DERROTA",
  ability: "HABILIDADE",
};

export function GameplaySpritePreview({ characterId }: { characterId: PlayableCharacterId }) {
  const [state, setState] = useState<AnimationState>("idle");

  return (
    <div className="flex flex-col items-center gap-3 border-2 border-arcade-panel-border bg-arcade-sky/25 p-3">
      <p className="font-arcade text-[0.55rem] text-arcade-cyan">SPRITE DE JOGO</p>
      <div className="flex h-28 items-end justify-center">
        <GameplaySprite
          key={`${characterId}-${state}`}
          characterId={characterId}
          animation={state}
          size={96}
        />
      </div>
      <div className="grid grid-cols-4 gap-1">
        {BASIC_ANIMATION_STATES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setState(s)}
            className={cn(
              "border-2 border-arcade-panel-border px-1.5 py-1 font-arcade text-[0.45rem] text-arcade-ink transition-colors hover:bg-arcade-lilac/40",
              state === s && "bg-arcade-lilac/60",
            )}
          >
            {LABELS[s]}
          </button>
        ))}
      </div>
    </div>
  );
}
