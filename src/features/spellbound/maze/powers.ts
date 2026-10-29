import type { PlayableCharacterId } from "../types";
import { MAZE_POWER_COOLDOWN_SECONDS } from "./config";

export interface MazePowerDefinition {
  name: string;
  shortName: string;
  description: string;
  cooldownSeconds: number;
  accent: string;
  glyph: string;
}

/**
 * These are maze-specific translations of each character's established identity.
 * They deliberately do not share or alter Tower's gameplay state or ability code.
 */
export const MAZE_CHARACTER_POWERS: Record<PlayableCharacterId, MazePowerDefinition> = {
  "white-fox-ice-mage": {
    name: "NOVA DE GELO",
    shortName: "GELO",
    description: "Congela por 5 s todos os espíritos na área 6×6 ao redor da Raposa.",
    cooldownSeconds: MAZE_POWER_COOLDOWN_SECONDS,
    accent: "#9ceeff",
    glyph: "❄",
  },
  "purple-rabbit-ninja": {
    name: "TELEPORTE NINJA",
    shortName: "TELEPORTE",
    description: "Escolha uma casa alcançável a até 6 blocos; confirme para surgir nela.",
    cooldownSeconds: MAZE_POWER_COOLDOWN_SECONDS,
    accent: "#db9cff",
    glyph: "✦",
  },
  "swamp-frog-mage": {
    name: "PÂNTANO PEGAJOSO",
    shortName: "PÂNTANO",
    description: "Cria no chão uma área 5×5 por 6 s; espíritos nela ficam bem mais lentos.",
    cooldownSeconds: MAZE_POWER_COOLDOWN_SECONDS,
    accent: "#9de89b",
    glyph: "✿",
  },
  "forge-raccoon-mage": {
    name: "EXPLOSÃO FLAMEJANTE",
    shortName: "EXPLOSÃO",
    description: "Empurra os espíritos próximos e os atordoa por 3 s.",
    cooldownSeconds: MAZE_POWER_COOLDOWN_SECONDS,
    accent: "#ffad73",
    glyph: "✹",
  },
  "time-owl-mage": {
    name: "PARAR O TEMPO",
    shortName: "TEMPO",
    description: "Para todos os espíritos do labirinto por 5 s; a Coruja continua se movendo.",
    cooldownSeconds: MAZE_POWER_COOLDOWN_SECONDS,
    accent: "#b6b2ff",
    glyph: "◷",
  },
  "calm-capybara-mage": {
    name: "CALMARIA",
    shortName: "CALMARIA",
    description: "Reduz a velocidade de todos os fantasmas para 42% por 5 s.",
    cooldownSeconds: MAZE_POWER_COOLDOWN_SECONDS,
    accent: "#9de8cf",
    glyph: "≈",
  },
  "axolotl-mage": {
    name: "RESSURREIÇÃO",
    shortName: "REVIVER",
    description: "Com uma runa, traz de volta o aliado eliminado mais recentemente com 1 vida; recarga de 20 s.",
    cooldownSeconds: MAZE_POWER_COOLDOWN_SECONDS,
    accent: "#ff9edb",
    glyph: "♥+",
  },
};

export const MAZE_CHARACTER_IDS = [
  "white-fox-ice-mage",
  "purple-rabbit-ninja",
  "time-owl-mage",
  "swamp-frog-mage",
  "forge-raccoon-mage",
  "calm-capybara-mage",
  "axolotl-mage",
] as const satisfies readonly PlayableCharacterId[];

export function getMazePower(characterId: PlayableCharacterId) {
  return MAZE_CHARACTER_POWERS[characterId];
}
