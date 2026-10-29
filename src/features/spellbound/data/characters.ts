import foxSprite from "@/assets/characters/fox.png";
import frogSprite from "@/assets/characters/frog.png";
import owlSprite from "@/assets/characters/owl.png";
import rabbitSprite from "@/assets/characters/rabbit.png";
import raccoonSprite from "@/assets/characters/raccoon.png";
import capybaraSprite from "@/assets/characters/capybara.png";
import axolotlSprite from "@/assets/characters/axolotl.png";

import type { PlayableCharacterId, PlayableCharacterSeed } from "../types";

export const playableCharacterSeeds: PlayableCharacterSeed[] = [
  {
    id: "white-fox-ice-mage",
    name: "Raposa Branca do Gelo",
    shortName: "RAPOSA",
    theme: "Gelo",
    magicLabel: "MAGIA DO GELO",
    description: "Uma maga capaz de controlar o gelo.",
    dominantColor: "Branco / Azul",
    badgeClassName: "bg-spell-ice",
    sprite: foxSprite,
  },
  {
    id: "purple-rabbit-ninja",
    name: "Coelho Ninja Roxo",
    shortName: "COELHO",
    theme: "Magia Ninja",
    magicLabel: "MAGIA NINJA",
    description: "Um ninja veloz que salta entre sombras mágicas.",
    dominantColor: "Roxo",
    badgeClassName: "bg-spell-ninja",
    sprite: rabbitSprite,
  },
  {
    id: "swamp-frog-mage",
    name: "Sapo Mago do Pântano",
    shortName: "SAPO",
    theme: "Pântano",
    magicLabel: "MAGIA DO PÂNTANO",
    description: "Um mago que desperta musgo, raízes e plantas.",
    dominantColor: "Verde",
    badgeClassName: "bg-spell-swamp",
    sprite: frogSprite,
  },
  {
    id: "forge-raccoon-mage",
    name: "Guaxinim da Forja",
    shortName: "GUAXINIM",
    theme: "Forja de Fogo",
    magicLabel: "MAGIA DA FORJA",
    description: "Um ferreiro que molda o fogo com seu martelo.",
    dominantColor: "Laranja / Vermelho",
    badgeClassName: "bg-spell-forge",
    sprite: raccoonSprite,
  },
  {
    id: "time-owl-mage",
    name: "Coruja do Tempo",
    shortName: "CORUJA",
    theme: "Tempo",
    magicLabel: "MAGIA DO TEMPO",
    description: "Uma maga misteriosa que dobra os ponteiros do tempo.",
    dominantColor: "Azul / Roxo",
    badgeClassName: "bg-spell-time",
    sprite: owlSprite,
  },
  {
    id: "calm-capybara-mage",
    name: "Capivara da Calmaria",
    shortName: "CAPIVARA",
    theme: "Calmaria",
    magicLabel: "MAGIA DA CALMARIA",
    description: "Uma maga tranquila que desacelera os espíritos e ajuda a alinhar peças.",
    dominantColor: "Canela / Azul / Ciano",
    badgeClassName: "bg-spell-time",
    sprite: capybaraSprite,
    coinCost: 1000,
  },
  {
    id: "axolotl-mage",
    name: "Axolote Guardião",
    shortName: "AXOLOTE",
    theme: "Vida e Renascimento",
    magicLabel: "MAGIA DA RESSURREIÇÃO",
    description: "Guarda um coração a mais e pode trazer um aliado de volta à partida.",
    dominantColor: "Rosa / Azul / Roxo",
    badgeClassName: "bg-spell-time",
    sprite: axolotlSprite,
    coinCost: 1000,
  },
];

export function getCharacterById(id: PlayableCharacterId | null) {
  return playableCharacterSeeds.find((character) => character.id === id) ?? null;
}
