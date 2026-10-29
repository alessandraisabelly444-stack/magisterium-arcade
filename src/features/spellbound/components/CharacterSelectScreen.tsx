import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useWalletBalance, type CharacterPurchaseResult } from "../currency";
import { getCharacterById, playableCharacterSeeds } from "../data/characters";
import type { PlayableCharacterId } from "../types";
import { PixelSceneDecor } from "./PixelSceneDecor";
import { GameplaySpritePreview } from "./GameplaySpritePreview";

interface CharacterSelectScreenProps {
  selectedId: PlayableCharacterId | null;
  walletId: string;
  unlockedCharacterIds: PlayableCharacterId[];
  onSelect: (id: PlayableCharacterId) => void;
  onPurchase: (id: PlayableCharacterId) => CharacterPurchaseResult;
  onBack: () => void;
}

export function CharacterSelectScreen({
  selectedId,
  walletId,
  unlockedCharacterIds,
  onSelect,
  onPurchase,
  onBack,
}: CharacterSelectScreenProps) {
  const selected = getCharacterById(selectedId);
  const coinBalance = useWalletBalance(walletId);
  const [purchaseFeedback, setPurchaseFeedback] = useState("");

  const handlePurchase = (characterId: PlayableCharacterId) => {
    const result = onPurchase(characterId);
    if (result === "purchased") {
      setPurchaseFeedback("PERSONAGEM DESBLOQUEADO! Agora você pode selecioná-lo.");
    } else if (result === "insufficient-funds") {
      setPurchaseFeedback("MOEDAS INSUFICIENTES PARA ESTA COMPRA.");
    } else {
      setPurchaseFeedback("ESTE PERSONAGEM JÁ ESTÁ DESBLOQUEADO.");
    }
  };

  return (
    <main className="celestial-sky relative min-h-screen overflow-hidden px-4 py-5 text-foreground sm:px-6 sm:py-8">
      <PixelSceneDecor />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-arcade text-[0.56rem] text-arcade-violet sm:text-xs">
              MAGISTERIUM ARCADE
            </p>
            <h1 className="pixel-title text-2xl leading-relaxed text-arcade-ink sm:text-4xl">
              PERSONAGENS
            </h1>
            <p className="mt-2 font-arcade text-[0.5rem] text-arcade-gold">
              SALDO: 🪙 {coinBalance.toLocaleString("pt-BR")}
            </p>
          </div>
          <Button type="button" variant="arcade" size="arcade" onClick={onBack}>
            VOLTAR AO LOBBY
          </Button>
        </header>

        <section className="pixel-panel grid gap-5 rounded-sm p-4 sm:p-6 md:grid-cols-[16rem_minmax(0,1fr)] lg:grid-cols-[16rem_minmax(0,1fr)_auto]">
          {selected ? (
            <>
              <div className="relative mx-auto flex h-56 w-56 items-center justify-center border-2 border-arcade-panel-border bg-arcade-sky/35">
                <div
                  className="absolute inset-6 animate-pulse rounded-full bg-arcade-cyan/30 blur-xl"
                  aria-hidden="true"
                />
                <img
                  key={selected.id}
                  src={selected.sprite}
                  alt={selected.name}
                  width={816}
                  height={816}
                  className="floaty relative h-52 w-52 object-contain [image-rendering:pixelated]"
                />
              </div>
              <div className="flex min-w-0 flex-col justify-center gap-3">
                <p className="font-arcade text-[0.6rem] text-arcade-cyan sm:text-xs">
                  PERSONAGEM SELECIONADO
                </p>
                <h2 className="pixel-title text-2xl leading-relaxed text-arcade-ink sm:text-3xl">
                  {selected.shortName}
                </h2>
                <p className="font-arcade text-xs text-arcade-lilac sm:text-sm">
                  {selected.magicLabel}
                </p>
                <p className="font-game text-xl leading-tight text-muted-foreground sm:text-2xl">
                  "{selected.description}"
                </p>
              </div>
              <GameplaySpritePreview characterId={selected.id} />
            </>
          ) : (
            <div className="col-span-full py-10 text-center">
              <p className="font-arcade text-xs text-arcade-cyan sm:text-sm">
                ESCOLHA SEU ANIMAL MAGO
              </p>
              <p className="mt-2 font-game text-xl text-muted-foreground">
                Selecione um personagem desbloqueado abaixo.
              </p>
            </div>
          )}
        </section>

        <section
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7"
          aria-label="Seleção de personagens"
        >
          {playableCharacterSeeds.map((character) => {
            const isSelected = character.id === selectedId;
            const isUnlocked =
              !character.coinCost || unlockedCharacterIds.includes(character.id);
            const canAfford = coinBalance >= (character.coinCost ?? 0);
            return (
              <button
                key={character.id}
                type="button"
                onClick={() =>
                  isUnlocked ? onSelect(character.id) : handlePurchase(character.id)
                }
                disabled={!isUnlocked && !canAfford}
                aria-pressed={isSelected}
                aria-label={
                  isUnlocked
                    ? `${character.name}: selecionar`
                    : canAfford
                      ? `Comprar ${character.name} por ${character.coinCost} moedas`
                      : `${character.name} bloqueado; faltam ${(character.coinCost ?? 0) - coinBalance} moedas`
                }
                className={cn(
                  "pixel-panel group flex flex-col items-center gap-2 rounded-sm p-3 text-center transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-arcade-cyan disabled:cursor-not-allowed disabled:opacity-75",
                  isSelected && "-translate-y-1 ring-4 ring-arcade-cyan",
                  !isUnlocked && "border-arcade-gold/70",
                )}
              >
                <img
                  src={character.sprite}
                  alt={character.name}
                  width={816}
                  height={816}
                  loading="lazy"
                  className={cn(
                    "h-28 w-28 object-contain [image-rendering:pixelated] transition-transform group-hover:scale-105",
                    isSelected && "floaty",
                    !isUnlocked && "grayscale-[0.25]",
                  )}
                />
                <h3 className="font-arcade text-[0.6rem] leading-relaxed text-arcade-ink sm:text-xs">
                  {character.shortName}
                </h3>
                <p className="font-arcade text-[0.5rem] leading-relaxed text-arcade-violet sm:text-[0.55rem]">
                  {character.magicLabel}
                </p>
                <p className="font-game text-base leading-tight text-muted-foreground">
                  {character.description}
                </p>
                {!isUnlocked && (
                  <span className="font-arcade text-[0.45rem] text-arcade-gold">
                    🔒 {character.coinCost?.toLocaleString("pt-BR")} MOEDAS
                  </span>
                )}
                <span
                  className={cn(
                    "mt-auto font-arcade text-[0.48rem]",
                    isSelected
                      ? "text-arcade-cyan"
                      : isUnlocked
                        ? "text-muted-foreground"
                        : "text-arcade-gold",
                  )}
                >
                  {isSelected
                    ? "✦ SELECIONADO ✦"
                    : isUnlocked
                      ? "SELECIONAR"
                      : canAfford
                        ? "COMPRAR"
                        : "MOEDAS INSUFICIENTES"}
                </span>
              </button>
            );
          })}
        </section>
        <p className="min-h-5 text-center font-arcade text-[0.5rem] text-arcade-cyan" aria-live="polite">
          {purchaseFeedback}
        </p>
      </div>
    </main>
  );
}
