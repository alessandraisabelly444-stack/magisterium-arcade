import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CURRENCY_CHANGE_EVENT,
  getPurchasedCharacterIds,
  purchaseCharacter as purchaseCharacterFromWallet,
  type CharacterPurchaseResult,
} from "../currency";
import { playableCharacterSeeds } from "../data/characters";
import type { PlayableCharacterId } from "../types";

const CHARACTER_SESSION_KEY = "spellbound-arcade-character";

function isCharacterId(value: string | null): value is PlayableCharacterId {
  return playableCharacterSeeds.some((character) => character.id === value);
}

export function useCharacterSelection(walletId: string) {
  const [selectedId, setSelectedId] = useState<PlayableCharacterId | null>(null);
  const [unlockRevision, setUnlockRevision] = useState(0);
  const purchasedCharacterIds = useMemo(
    () => getPurchasedCharacterIds(walletId),
    [walletId, unlockRevision],
  );
  const unlockedCharacterIds = useMemo(
    () =>
      playableCharacterSeeds
        .filter((character) => !character.coinCost || purchasedCharacterIds.includes(character.id))
        .map((character) => character.id),
    [purchasedCharacterIds],
  );

  useEffect(() => {
    const refreshUnlocks = () => setUnlockRevision((revision) => revision + 1);
    window.addEventListener(CURRENCY_CHANGE_EVENT, refreshUnlocks);
    window.addEventListener("storage", refreshUnlocks);
    return () => {
      window.removeEventListener(CURRENCY_CHANGE_EVENT, refreshUnlocks);
      window.removeEventListener("storage", refreshUnlocks);
    };
  }, []);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(CHARACTER_SESSION_KEY);
    const character = playableCharacterSeeds.find((candidate) => candidate.id === stored);
    if (
      isCharacterId(stored) &&
      (!character?.coinCost || purchasedCharacterIds.includes(stored))
    ) {
      setSelectedId(stored);
    } else {
      setSelectedId(null);
    }
  }, [walletId, purchasedCharacterIds]);

  const selectCharacter = useCallback(
    (id: PlayableCharacterId) => {
      const character = playableCharacterSeeds.find((candidate) => candidate.id === id);
      if (character?.coinCost && !getPurchasedCharacterIds(walletId).includes(id)) return false;
      window.sessionStorage.setItem(CHARACTER_SESSION_KEY, id);
      setSelectedId(id);
      return true;
    },
    [walletId],
  );

  const purchaseCharacter = useCallback(
    (id: PlayableCharacterId): CharacterPurchaseResult => {
      const character = playableCharacterSeeds.find((candidate) => candidate.id === id);
      if (!character?.coinCost) return "already-unlocked";
      return purchaseCharacterFromWallet(walletId, id, character.coinCost);
    },
    [walletId],
  );

  return { selectedId, selectCharacter, unlockedCharacterIds, purchaseCharacter };
}
