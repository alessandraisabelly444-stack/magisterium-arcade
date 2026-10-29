import { useCallback, useState } from "react";

import { MAX_PLAYER_NAME_LENGTH, normalizePlayerName, setActivePlayerName } from "../playerProfile";

export interface PlayerEntryResult {
  ok: boolean;
  message: string;
}

export function usePlayerSession() {
  const [playerName, setPlayerName] = useState("");

  const enterByName = useCallback(async (rawName: string): Promise<PlayerEntryResult> => {
    const requestedName = normalizePlayerName(rawName);
    if (!requestedName) {
      return {
        ok: false,
        message: `Digite um nome de até ${MAX_PLAYER_NAME_LENGTH} caracteres.`,
      };
    }

    setActivePlayerName(requestedName.displayName);
    setPlayerName(requestedName.displayName);
    return { ok: true, message: "BOM JOGO!" };
  }, []);

  const changePlayer = useCallback(() => {
    setActivePlayerName(null);
    setPlayerName("");
  }, []);

  return {
    isReady: true,
    playerName,
    hasPlayerName: playerName.length > 0,
    enterByName,
    changePlayer,
  };
}
