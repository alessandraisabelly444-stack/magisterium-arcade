import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import { useWalletBalance } from "../currency";
import { lobbyOptions } from "../data/lobbyOptions";
import type { LobbyOption, PlayableCharacterId } from "../types";
import { GlobalLeaderboardPanel } from "../leaderboard/GlobalLeaderboardPanel";
import { useGlobalLeaderboard } from "../leaderboard/useGlobalLeaderboard";
import { CharacterPreviewRail } from "./CharacterPreviewRail";
import { ComingSoonNotice } from "./ComingSoonNotice";
import { LobbyOptionButton } from "./LobbyOptionButton";
import { PixelSceneDecor } from "./PixelSceneDecor";
import { PlayerBadge } from "./PlayerBadge";

const hiddenMainMenuOptionIds = new Set(["characters", "customize", "leaderboard"]);

interface LobbyScreenProps {
  playerName: string;
  walletId: string;
  onChangePlayer: () => void;
  selectedCharacterId: PlayableCharacterId | null;
  unlockedCharacterIds: PlayableCharacterId[];
  onOpenCharacters: () => void;
  onOpenTower: () => void;
  onOpenSkyFlap: () => void;
  onOpenSkyRun: () => void;
  onOpenMaze: () => void;
}

export function LobbyScreen({
  playerName,
  walletId,
  onChangePlayer,
  selectedCharacterId,
  unlockedCharacterIds,
  onOpenCharacters,
  onOpenTower,
  onOpenSkyFlap,
  onOpenSkyRun,
  onOpenMaze,
}: LobbyScreenProps) {
  const [selectedOption, setSelectedOption] = useState<LobbyOption | null>(null);
  const coinBalance = useWalletBalance(walletId);
  const leaderboard = useGlobalLeaderboard(playerName);

  const handleSelectOption = (option: LobbyOption) => {
    if (option.id === "characters") {
      onOpenCharacters();
      return;
    }
    if (option.id === "tower") {
      onOpenTower();
      return;
    }
    if (option.id === "sky-flap") {
      onOpenSkyFlap();
      return;
    }
    if (option.id === "sky-run") {
      onOpenSkyRun();
      return;
    }
    if (option.id === "spellbound-maze") {
      onOpenMaze();
      return;
    }
    setSelectedOption(option);
  };

  useEffect(() => {
    if (!selectedOption) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSelectedOption(null);
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [selectedOption]);

  return (
    <main className="celestial-sky relative min-h-screen overflow-hidden px-4 py-5 text-foreground sm:px-6 sm:py-8">
      <PixelSceneDecor />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
          <div className="min-w-0">
            <p className="font-arcade text-[0.56rem] text-arcade-violet sm:text-xs">
              LOBBY CELESTIAL
            </p>
            <h1 className="pixel-title truncate text-2xl leading-relaxed text-arcade-ink sm:text-4xl lg:text-5xl">
              MAGISTERIUM ARCADE
            </h1>
          </div>
          <PlayerBadge playerName={playerName} />
        </header>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem]">
          <div className="pixel-panel min-w-0 rounded-sm p-3 sm:p-5">
            <GlobalLeaderboardPanel
              entries={leaderboard.entries}
              isLoading={leaderboard.isLoading}
              error={leaderboard.error}
              onRefresh={() => void leaderboard.refresh()}
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="border-2 border-arcade-panel-border bg-arcade-sky/35 p-3 text-center">
                <p className="font-arcade text-[0.52rem] text-arcade-cyan sm:text-[0.62rem]">CEU</p>
                <p className="text-sm text-muted-foreground sm:text-base">ABERTO</p>
              </div>
              <div className="border-2 border-arcade-panel-border bg-arcade-sky/35 p-3 text-center">
                <p className="font-arcade text-[0.52rem] text-arcade-pink sm:text-[0.62rem]">
                  MAGIA
                </p>
                <p className="text-sm text-muted-foreground sm:text-base">CARREGANDO</p>
              </div>
              <div className="border-2 border-arcade-panel-border bg-arcade-sky/35 p-3 text-center">
                <p className="font-arcade text-[0.52rem] text-arcade-violet sm:text-[0.62rem]">
                  ARCADE
                </p>
                <p className="text-sm text-muted-foreground sm:text-base">PRONTO</p>
              </div>
              <div className="border-2 border-arcade-gold bg-arcade-sky/55 p-3 text-center shadow-[3px_3px_0_var(--color-arcade-shadow)]">
                <p className="font-arcade text-[0.52rem] text-arcade-gold sm:text-[0.62rem]">
                  TOTAL DE MOEDAS
                </p>
                <p
                  className="mt-1 font-arcade text-sm text-arcade-ink sm:text-base"
                  aria-live="polite"
                >
                  🪙 {coinBalance.toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          </div>

          <aside className="min-w-0 space-y-4">
            <div className="pixel-panel rounded-sm p-4">
              <h2 className="mb-4 font-arcade text-xs text-arcade-violet sm:text-sm">
                MENU PRINCIPAL
              </h2>
              <div className="grid gap-3">
                {lobbyOptions
                  .filter((option) => !hiddenMainMenuOptionIds.has(option.id))
                  .map((option) => (
                    <LobbyOptionButton
                      key={option.id}
                      option={option}
                      onSelect={handleSelectOption}
                    />
                  ))}
              </div>
            </div>

            <Button
              type="button"
              variant="arcade"
              size="arcade"
              onClick={onChangePlayer}
              className="w-full"
            >
              TROCAR JOGADOR
            </Button>
          </aside>
        </section>

        <CharacterPreviewRail
          selectedId={selectedCharacterId}
          unlockedCharacterIds={unlockedCharacterIds}
          onOpen={onOpenCharacters}
        />
      </div>

      {selectedOption ? <ComingSoonNotice label={selectedOption.label} /> : null}
    </main>
  );
}
