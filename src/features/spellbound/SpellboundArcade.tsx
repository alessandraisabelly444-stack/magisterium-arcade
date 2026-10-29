import { useEffect, useState } from "react";

import { CharacterSelectScreen } from "./components/CharacterSelectScreen";
import { GameModeSelectorScreen } from "./components/GameModeSelectorScreen";
import { LobbyScreen } from "./components/LobbyScreen";
import { MultiplayerActionMenuScreen } from "./components/MultiplayerActionMenuScreen";
import { NameEntryScreen } from "./components/NameEntryScreen";
import { TowerScreen } from "./tower/TowerScreen";
import { TowerLocalScreen } from "./tower/TowerLocalScreen";
import { SkyFlapScreen } from "./skyflap/SkyFlapScreen";
import { SkyFlapModeSelectScreen } from "./skyflap/SkyFlapModeSelectScreen";
import { SkyFlapMultiplayerScreen } from "./skyflap/SkyFlapMultiplayerScreen";
import { SkyRunScreen } from "./skyrun/SkyRunScreen";
import { SkyRunMultiplayerScreen } from "./skyrun/SkyRunMultiplayerScreen";
import { MazeScreen } from "./maze/MazeScreen";
import { useCharacterSelection } from "./hooks/useCharacterSelection";
import { usePlayerSession } from "./hooks/usePlayerSession";
import { walletIdForPlayerName } from "./currency";
import { ArcadeAudioProvider } from "./audio/ArcadeAudioProvider";
import { AudioSettingsButton } from "./audio/AudioSettingsButton";
import type { ArcadeTrack } from "./audio/types";
import type { ArcadeMinigameId, SpellboundView } from "./types";

function trackForGame(gameId: ArcadeMinigameId): ArcadeTrack {
  if (gameId === "spellbound-maze") return "maze";
  return gameId;
}

function SpellboundArcadeApp({
  onTrackChange,
}: {
  onTrackChange: (track: ArcadeTrack | null) => void;
}) {
  const { isReady, playerName, hasPlayerName, enterByName, changePlayer } = usePlayerSession();
  const walletId = walletIdForPlayerName(playerName);
  const { selectedId, selectCharacter, unlockedCharacterIds, purchaseCharacter } =
    useCharacterSelection(walletId);
  const [view, setView] = useState<SpellboundView>("lobby");
  const [multiplayerGameId, setMultiplayerGameId] = useState<ArcadeMinigameId>("tower");
  const audioTrack: ArcadeTrack | null =
    !isReady || !hasPlayerName
      ? null
      : view === "multiplayer-menu"
        ? trackForGame(multiplayerGameId)
        : view === "tower" || view === "tower-local"
          ? "tower"
          : view.includes("sky-flap")
            ? "sky-flap"
            : view.includes("sky-run")
              ? "sky-run"
              : view.startsWith("maze")
                ? "maze"
                : "lobby";

  useEffect(() => onTrackChange(audioTrack), [audioTrack, onTrackChange]);

  const openMultiplayerMenu = (gameId: ArcadeMinigameId) => {
    setMultiplayerGameId(gameId);
    setView("multiplayer-menu");
  };

  const startBotMatch = () => {
    if (multiplayerGameId === "tower") setView("tower");
    else if (multiplayerGameId === "sky-flap") setView("sky-flap-bots");
    else if (multiplayerGameId === "spellbound-maze") setView("maze-bots");
    else setView("sky-run-multiplayer");
  };

  const backFromMultiplayerMenu = () => {
    if (multiplayerGameId === "tower") setView("lobby");
    else if (multiplayerGameId === "sky-flap") setView("sky-flap");
    else if (multiplayerGameId === "spellbound-maze") setView("maze-modes");
    else setView("sky-run-modes");
  };

  if (!isReady) {
    return (
      <main className="celestial-sky flex min-h-screen items-center justify-center px-4 text-center">
        <p className="pixel-title font-arcade text-sm text-arcade-ink">CARREGANDO GRIMORIO...</p>
      </main>
    );
  }

  if (!hasPlayerName) {
    return <NameEntryScreen onEnter={enterByName} />;
  }

  if (view === "characters") {
    return (
      <CharacterSelectScreen
        selectedId={selectedId}
        onSelect={selectCharacter}
        onPurchase={purchaseCharacter}
        walletId={walletId}
        unlockedCharacterIds={unlockedCharacterIds}
        onBack={() => setView("lobby")}
      />
    );
  }

  if (view === "multiplayer-menu") {
    return (
      <MultiplayerActionMenuScreen
        gameId={multiplayerGameId}
        onBots={startBotMatch}
        {...(multiplayerGameId === "tower" ? { onLocal: () => setView("tower-local") } : {})}
        {...(multiplayerGameId === "sky-flap"
          ? { onLocal: () => setView("sky-flap-multiplayer") }
          : {})}
        {...(multiplayerGameId === "spellbound-maze"
          ? { onLocal: () => setView("maze-local") }
          : {})}
        {...(multiplayerGameId === "sky-run" ? { onLocal: () => setView("sky-run-local") } : {})}
        onBack={backFromMultiplayerMenu}
      />
    );
  }

  if (view === "tower") {
    return (
      <TowerScreen
        characterId={selectedId}
        unlockedCharacterIds={unlockedCharacterIds}
        playerName={playerName}
        primaryWalletId={walletId}
        onBack={() => setView("multiplayer-menu")}
        onChangeGame={() => setView("lobby")}
      />
    );
  }

  if (view === "tower-local") {
    return (
      <TowerLocalScreen
        playerName={playerName}
        primaryWalletId={walletId}
        onBack={() => setView("multiplayer-menu")}
        onChangeGame={() => setView("lobby")}
      />
    );
  }

  if (view === "sky-flap") {
    return (
      <SkyFlapModeSelectScreen
        onSolo={() => setView("sky-flap-solo")}
        onMultiplayer={() => openMultiplayerMenu("sky-flap")}
        onBack={() => setView("lobby")}
      />
    );
  }

  if (view === "sky-flap-solo") {
    return (
      <SkyFlapScreen
        characterId={selectedId}
        playerName={playerName}
        primaryWalletId={walletId}
        onBack={() => setView("sky-flap")}
      />
    );
  }

  if (view === "sky-flap-multiplayer") {
    return (
      <SkyFlapMultiplayerScreen
        selectedCharacterId={selectedId}
        playerName={playerName}
        primaryWalletId={walletId}
        onBack={() => setView("multiplayer-menu")}
        onChangeGame={() => setView("lobby")}
      />
    );
  }

  if (view === "sky-flap-bots") {
    return (
      <SkyFlapMultiplayerScreen
        selectedCharacterId={selectedId}
        playerName={playerName}
        mode="bots"
        primaryWalletId={walletId}
        onBack={() => setView("multiplayer-menu")}
        onChangeGame={() => setView("lobby")}
      />
    );
  }

  if (view === "sky-run-modes") {
    return (
      <GameModeSelectorScreen
        gameId="sky-run"
        onSingleplayer={() => setView("sky-run")}
        onMultiplayer={() => openMultiplayerMenu("sky-run")}
        onBack={() => setView("lobby")}
      />
    );
  }

  if (view === "sky-run") {
    return (
      <SkyRunScreen
        characterId={selectedId}
        playerName={playerName}
        primaryWalletId={walletId}
        onBack={() => setView("sky-run-modes")}
      />
    );
  }

  if (view === "sky-run-multiplayer" || view === "sky-run-local") {
    return (
      <SkyRunMultiplayerScreen
        playerName={playerName}
        selectedCharacterId={selectedId}
        primaryWalletId={walletId}
        mode={view === "sky-run-local" ? "local" : "bots"}
        onBack={() => setView("multiplayer-menu")}
        onChangeGame={() => setView("lobby")}
      />
    );
  }

  if (view === "maze-modes") {
    return (
      <GameModeSelectorScreen
        gameId="spellbound-maze"
        onSingleplayer={() => setView("maze-solo")}
        onMultiplayer={() => openMultiplayerMenu("spellbound-maze")}
        onBack={() => setView("lobby")}
      />
    );
  }

  if (view === "maze-solo" || view === "maze-bots" || view === "maze-local") {
    const mode = view === "maze-solo" ? "solo" : view === "maze-bots" ? "bots" : "local";
    return (
      <MazeScreen
        mode={mode}
        playerName={playerName}
        selectedCharacterId={selectedId}
        unlockedCharacterIds={unlockedCharacterIds}
        primaryWalletId={walletId}
        onBack={() => setView(mode === "solo" ? "maze-modes" : "multiplayer-menu")}
        onChangeGame={() => setView("lobby")}
      />
    );
  }

  return (
    <LobbyScreen
      playerName={playerName}
      walletId={walletId}
      onChangePlayer={() => {
        changePlayer();
        setView("lobby");
      }}
      selectedCharacterId={selectedId}
      unlockedCharacterIds={unlockedCharacterIds}
      onOpenCharacters={() => setView("characters")}
      onOpenTower={() => openMultiplayerMenu("tower")}
      onOpenSkyFlap={() => setView("sky-flap")}
      onOpenSkyRun={() => setView("sky-run-modes")}
      onOpenMaze={() => setView("maze-modes")}
    />
  );
}

export function SpellboundArcade() {
  const [track, setTrack] = useState<ArcadeTrack | null>(null);

  return (
    <ArcadeAudioProvider track={track}>
      <SpellboundArcadeApp onTrackChange={setTrack} />
      {track ? <AudioSettingsButton /> : null}
    </ArcadeAudioProvider>
  );
}
