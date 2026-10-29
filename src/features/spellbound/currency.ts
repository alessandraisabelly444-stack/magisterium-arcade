import { useEffect, useState } from "react";

import { syncGlobalCoinReward } from "./leaderboard/api";
import { normalizePlayerName } from "./playerProfile";
import type { PlayableCharacterId } from "./types";

const CURRENCY_STORAGE_KEY = "spellbound-arcade-currency-v1";
export const CURRENCY_CHANGE_EVENT = "spellbound-arcade:currency-change";

interface CurrencyStore {
  version: 1;
  balances: Record<string, number>;
  receipts: Record<string, CurrencyRewardReceipt[]>;
  unlockedCharacters: Record<string, PlayableCharacterId[]>;
}

export type CharacterPurchaseResult = "purchased" | "already-unlocked" | "insufficient-funds";

export interface CurrencyRewardEntry {
  walletId: string;
  playerId: string;
  playerName: string;
  amount: number;
}

export interface CurrencyRewardReceipt extends CurrencyRewardEntry {
  total: number;
}

const emptyStore = (): CurrencyStore => ({
  version: 1,
  balances: {},
  receipts: {},
  unlockedCharacters: {},
});
let memoryStore = emptyStore();
let matchIdCounter = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStore(): CurrencyStore {
  if (typeof window === "undefined") return memoryStore;
  try {
    const raw = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (!raw) return memoryStore;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed["version"] !== 1) return memoryStore;
    return {
      version: 1,
      balances: isRecord(parsed["balances"]) ? (parsed["balances"] as Record<string, number>) : {},
      receipts: isRecord(parsed["receipts"])
        ? (parsed["receipts"] as Record<string, CurrencyRewardReceipt[]>)
        : {},
      unlockedCharacters: isRecord(parsed["unlockedCharacters"])
        ? (parsed["unlockedCharacters"] as Record<string, PlayableCharacterId[]>)
        : {},
    };
  } catch {
    return memoryStore;
  }
}

function writeStore(store: CurrencyStore) {
  memoryStore = store;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // The arcade remains playable with an in-memory balance if browser storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(CURRENCY_CHANGE_EVENT));
}

function normalizeAmount(amount: number) {
  return Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
}

export function getWalletBalance(walletId: string) {
  const balance = readStore().balances[walletId];
  return typeof balance === "number" && Number.isFinite(balance)
    ? Math.max(0, Math.floor(balance))
    : 0;
}

export function getPurchasedCharacterIds(walletId: string): PlayableCharacterId[] {
  const stored = readStore().unlockedCharacters[walletId];
  return Array.isArray(stored) ? [...new Set(stored)] : [];
}

/** Deducts coins and records ownership in one localStorage write, so a character cannot be charged twice. */
export function purchaseCharacter(
  walletId: string,
  characterId: PlayableCharacterId,
  cost: number,
): CharacterPurchaseResult {
  if (!walletId) return "insufficient-funds";
  const store = readStore();
  const unlocked = store.unlockedCharacters[walletId] ?? [];
  if (unlocked.includes(characterId)) return "already-unlocked";

  const price = normalizeAmount(cost);
  const balance = normalizeAmount(store.balances[walletId] ?? 0);
  if (balance < price) return "insufficient-funds";

  store.balances[walletId] = balance - price;
  store.unlockedCharacters[walletId] = [...unlocked, characterId];
  writeStore(store);
  return "purchased";
}

export function setWalletBalance(walletId: string, amount: number) {
  if (!walletId) return;
  const store = readStore();
  const balance = normalizeAmount(amount);
  if (store.balances[walletId] === balance) return;
  store.balances[walletId] = balance;
  writeStore(store);
}

export function getMatchRewardReceipts(matchId: string) {
  const receipts = readStore().receipts[matchId];
  return Array.isArray(receipts) ? receipts.map((receipt) => ({ ...receipt })) : [];
}

/**
 * Credits each participant once for a given match, while allowing eliminated participants to be
 * settled before the remaining local players finish. Repeated calls return the original receipt.
 */
export function settleMatchRewards(matchId: string, entries: CurrencyRewardEntry[]) {
  if (!matchId || entries.length === 0) return getMatchRewardReceipts(matchId);
  const store = readStore();
  const receipts = [...(store.receipts[matchId] ?? [])];
  const settledWallets = new Set(receipts.map((receipt) => receipt.walletId));
  let changed = false;

  for (const entry of entries) {
    if (!entry.walletId || settledWallets.has(entry.walletId)) continue;
    const amount = normalizeAmount(entry.amount);
    const total = normalizeAmount(store.balances[entry.walletId] ?? 0) + amount;
    const receipt: CurrencyRewardReceipt = {
      walletId: entry.walletId,
      playerId: entry.playerId,
      playerName: entry.playerName.trim() || "JOGADOR",
      amount,
      total,
    };
    store.balances[entry.walletId] = total;
    receipts.push(receipt);
    settledWallets.add(entry.walletId);
    changed = true;
  }

  if (changed) {
    store.receipts[matchId] = receipts;
    writeStore(store);
  }
  return receipts.map((receipt) => ({ ...receipt }));
}

export function createMatchId(gameId: string) {
  matchIdCounter += 1;
  const nonce =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${matchIdCounter.toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${gameId}:${nonce}`;
}

/** Uses the entered name to select this browser's local player wallet; it does not authenticate anyone. */
export function walletIdForPlayerName(playerName: string) {
  const normalized = normalizePlayerName(playerName)?.normalizedName ?? "";
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `profile:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

/** Local multiplayer participants beyond slot 1 keep distinct balances shared across games. */
export function walletIdForLocalSlot(slotIndex: number) {
  return `local-slot:${Math.max(2, Math.floor(slotIndex) + 1)}`;
}

export function useWalletBalance(walletId: string) {
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    const refresh = () => setBalance(getWalletBalance(walletId));
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === CURRENCY_STORAGE_KEY) refresh();
    };
    refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener(CURRENCY_CHANGE_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CURRENCY_CHANGE_EVENT, refresh);
    };
  }, [walletId]);

  return balance;
}

/** Settles only finalized participants. The JSON signature keeps the effect quiet during RAF HUD updates. */
export function useMatchCurrencyRewards(
  matchId: string,
  finalizedEntries: CurrencyRewardEntry[],
  primaryWalletId?: string,
) {
  const payload = JSON.stringify(finalizedEntries);
  const [receipts, setReceipts] = useState<CurrencyRewardReceipt[]>([]);

  useEffect(() => {
    const entries = JSON.parse(payload) as CurrencyRewardEntry[];
    const settledReceipts = settleMatchRewards(matchId, entries);
    setReceipts(getMatchRewardReceipts(matchId));
    const primaryReceipt = settledReceipts.find((receipt) => receipt.walletId === primaryWalletId);
    if (primaryWalletId && primaryReceipt) {
      void syncGlobalCoinReward(matchId, primaryReceipt.amount);
    }
  }, [matchId, payload, primaryWalletId]);

  return receipts;
}
