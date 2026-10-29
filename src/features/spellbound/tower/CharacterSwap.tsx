import { useEffect, useState } from "react";

import { playableCharacterSeeds } from "../data/characters";
import { GameplaySprite } from "../gameplay/sprites/GameplaySprite";
import type { PlayableCharacterId } from "../types";

/** Visual-only swap flavour per character (no gameplay effect). */
const SWAP_FX: Record<PlayableCharacterId, { colors: string[]; glyphs: string[] }> = {
  "white-fox-ice-mage": { colors: ["#ffffff", "#bdf3ff", "#7fd8ff"], glyphs: ["❄", "✦", "·"] },
  "purple-rabbit-ninja": { colors: ["#e3cbff", "#b58cff", "#ffffff"], glyphs: ["✦", "»", "·"] },
  "swamp-frog-mage": { colors: ["#9fe8b0", "#5fcf8a", "#d8ffe0"], glyphs: ["✿", "•", "·"] },
  "forge-raccoon-mage": { colors: ["#ffc4b8", "#ff9e9e", "#ffffff"], glyphs: ["✧", "•", "·"] },
  "time-owl-mage": { colors: ["#9fb8ff", "#b58cff", "#ffffff"], glyphs: ["⧗", "◷", "✦"] },
  "calm-capybara-mage": { colors: ["#9de8cf", "#72d9e8", "#ffffff"], glyphs: ["≈", "✦", "·"] },
  "axolotl-mage": { colors: ["#ff9edb", "#82e9ff", "#ffffff"], glyphs: ["♥", "✦", "·"] },
};

interface SwapModalProps {
  current: PlayableCharacterId | null;
  unlockedCharacterIds: PlayableCharacterId[];
  onPick: (id: PlayableCharacterId) => void;
  onClose: () => void;
}

export function CharacterSwapModal({ current, unlockedCharacterIds, onPick, onClose }: SwapModalProps) {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-arcade-ink/45 p-3"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Trocar personagem"
        className="swap-pop w-full max-w-[360px] border-4 border-arcade-panel-border bg-arcade-panel p-3 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="pixel-title text-sm text-arcade-ink">TROCAR PERSONAGEM</h2>
          <button
            type="button"
            onClick={onClose}
            className="font-arcade text-[0.5rem] text-arcade-violet hover:text-arcade-ink"
            aria-label="Fechar"
          >
            ESC ✕
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {playableCharacterSeeds.filter((c) => unlockedCharacterIds.includes(c.id)).map((c) => {
            const active = c.id === current;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onPick(c.id)}
                aria-pressed={active}
                className={`flex flex-col items-center gap-1 border-2 px-1 py-1.5 transition-transform hover:-translate-y-0.5 ${
                  active
                    ? "border-arcade-cyan bg-arcade-cyan/25 ring-2 ring-arcade-violet"
                    : "border-arcade-panel-border bg-background/40"
                }`}
              >
                <GameplaySprite
                  characterId={c.id}
                  animation={active ? "victory" : "idle"}
                  size={40}
                />
                <span className="font-arcade text-[0.4rem] leading-tight text-arcade-ink">
                  {c.shortName}
                </span>
                {active && (
                  <span className="font-arcade text-[0.35rem] text-arcade-violet">ATUAL</span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-center font-arcade text-[0.4rem] text-arcade-violet">
          PARTIDA PAUSADA
        </p>
      </div>
    </div>
  );
}

interface SwapHeroProps {
  characterId: PlayableCharacterId | null;
  animation: "idle" | "victory" | "defeat";
  size: number;
}

/** Renders the player's hero; animates old → particles → new whenever characterId changes. */
export function SwapHero({ characterId, animation, size }: SwapHeroProps) {
  const [shown, setShown] = useState(characterId);
  const [fx, setFx] = useState<{
    from: PlayableCharacterId | null;
    to: PlayableCharacterId;
    key: number;
  } | null>(null);

  useEffect(() => {
    if (characterId === shown || !characterId) return;
    const key = Date.now();
    setFx({ from: shown, to: characterId, key });
    const t1 = window.setTimeout(() => setShown(characterId), 250);
    const t2 = window.setTimeout(() => setFx((f) => (f?.key === key ? null : f)), 650);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      setShown(characterId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  if (!shown) return null;
  const leaving = fx && shown === fx.from;
  const style = fx ? SWAP_FX[fx.to] : null;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div
        key={`${shown}-${fx?.key ?? 0}`}
        className={fx ? (leaving ? "swap-out" : "swap-in") : ""}
      >
        <GameplaySprite
          characterId={shown}
          animation={fx && !leaving ? "victory" : animation}
          size={size}
        />
      </div>
      {fx && style && (
        <div key={fx.key} className="pointer-events-none absolute inset-0" aria-hidden="true">
          <span
            className="swap-flash absolute inset-[-30%]"
            style={{
              background: `radial-gradient(circle, ${style.colors[0]}, ${style.colors[1]}88 45%, transparent 70%)`,
            }}
          />
          {Array.from({ length: 12 }).map((_, i) => {
            const ang = (i / 12) * Math.PI * 2;
            const r = size * (0.55 + (i % 3) * 0.15);
            return (
              <span
                key={i}
                className="swap-particle absolute left-1/2 top-1/2 font-arcade text-[0.6rem] leading-none"
                style={
                  {
                    color: style.colors[i % style.colors.length],
                    textShadow: `0 0 4px ${style.colors[1]}`,
                    "--dx": `${Math.cos(ang) * r}px`,
                    "--dy": `${Math.sin(ang) * r}px`,
                    animationDelay: `${(i % 4) * 30}ms`,
                  } as React.CSSProperties
                }
              >
                {style.glyphs[i % style.glyphs.length]}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
