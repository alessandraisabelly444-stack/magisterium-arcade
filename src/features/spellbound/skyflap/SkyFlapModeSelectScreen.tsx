import { GameModeSelectorScreen } from "../components/GameModeSelectorScreen";

interface SkyFlapModeSelectScreenProps {
  onSolo: () => void;
  onMultiplayer: () => void;
  onBack: () => void;
}

export function SkyFlapModeSelectScreen({
  onSolo,
  onMultiplayer,
  onBack,
}: SkyFlapModeSelectScreenProps) {
  return (
    <GameModeSelectorScreen
      gameId="sky-flap"
      onSingleplayer={onSolo}
      onMultiplayer={onMultiplayer}
      onBack={onBack}
    />
  );
}
