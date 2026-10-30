import type { PlayableCharacterId } from "../../types";
import { baseAnimations } from "./baseAnimations";
import type {
  AnimationSet,
  AnimationState,
  GameplaySpriteDefinition,
  SpriteAnimation,
} from "./types";

// Legend: o outline · b body · l light/belly · a robe · c detail · e eye · m magic · n nose
const fox: GameplaySpriteDefinition = {
  characterId: "white-fox-ice-mage",
  legColumns: [5, 9],
  palette: {
    o: "#1e2a5a",
    b: "#f7fbff",
    l: "#cfe6ff",
    a: "#4aa3f0",
    c: "#9ee8ff",
    e: "#1e2a5a",
    m: "#b8f4ff",
    n: "#1e2a5a",
  },
  grid: [
    "..o.......o.....",
    ".oco.....oco....",
    ".obbo...obbo....",
    ".obbboooobbo....",
    ".obbbbbbbbbo....",
    "obebbbbbbbebo...",
    "obbbblnlbbbbo...",
    ".obblllllbbo..o.",
    "..obbllllbo..obo",
    "..oaaacaaaao.obo",
    ".oaaalllaaaoocbo",
    ".oaaalllaaaobbo.",
    "..oaaacaaaoobo..",
    "...ooooooooo....",
  ],
};

const rabbit: GameplaySpriteDefinition = {
  characterId: "purple-rabbit-ninja",
  legColumns: [5, 9],
  palette: {
    o: "#2a1648",
    b: "#a67ae8",
    l: "#e3d2ff",
    a: "#3b2a6e",
    c: "#ff6fb0",
    e: "#ffffff",
    m: "#d9b8ff",
    n: "#ff9ac8",
  },
  grid: [
    "...oo...oo......",
    "..obbo.oblo.....",
    "..oblo.oblo.....",
    "..oblo.oblo.....",
    "..obbooobbo.....",
    ".obbbbbbbbbo....",
    ".oaaaaaaaaaocc..",
    ".oaeaaaaaeaoc...",
    ".obbbbnbbbbo....",
    "..obbllbbbo.....",
    "..oaaaaaaaao....",
    ".oaaacccaaaao...",
    "..oaaaaaaaao....",
    "...ooooooooo....",
  ],
  animations: {
    ability: {
      fps: 12,
      loop: true,
      frames: [
        { legs: "spread", rotate: -8, dx: -1 },
        { legs: "tuck", rotate: 10, dx: 1, fx: "sparkle" },
        { legs: "stand", rotate: -4 },
      ],
    },
  },
};

const frog: GameplaySpriteDefinition = {
  characterId: "swamp-frog-mage",
  legColumns: [4, 10],
  palette: {
    o: "#12331f",
    b: "#5cc46a",
    l: "#c8f0a8",
    a: "#3c7a4a",
    c: "#8fe06a",
    e: "#12331f",
    m: "#b4ff9a",
    n: "#e87a8a",
  },
  grid: [
    "...ooo....ooo...",
    "..olelo..olelo..",
    "..olllo..olllo..",
    ".obbbbbbbbbbbbo.",
    ".obbbbbbbbbbbbo.",
    ".obbnnnnnnnnbbo.",
    "..obbbbbbbbbbo..",
    "...occcccccco...",
    "..oaaaaaaaaaao..",
    ".oaaallllllaaao.",
    ".oaaallllllaaao.",
    ".oaaacaaaacaaao.",
    "..oaaaaaaaaaao..",
    "...oooooooooo...",
  ],
};

const raccoon: GameplaySpriteDefinition = {
  characterId: "forge-raccoon-mage",
  legColumns: [5, 9],
  palette: {
    o: "#241a1a",
    b: "#9aa0ad",
    l: "#e6e8ee",
    a: "#8a4a2a",
    c: "#ff7a2a",
    e: "#ffffff",
    m: "#ffb347",
    n: "#241a1a",
  },
  grid: [
    "..oo......oo....",
    ".obbo....obbo...",
    ".obbboooobbbo...",
    ".obbbbbbbbbbo...",
    "ooooeooooeoooo..",
    ".oolllllllllo...",
    ".obllllnlllbo.oo",
    "..obllllllbo.obo",
    "...obbbbbbo.oolo",
    "..oaaaaaaaaoobo.",
    ".oaalllllaaoolo.",
    ".oacalllacaobo..",
    "..oaaaaaaaao....",
    "...ooooooooo....",
  ],
};

const owl: GameplaySpriteDefinition = {
  characterId: "time-owl-mage",
  legColumns: [5, 9],
  palette: {
    o: "#1a1a4a",
    b: "#5a6ee0",
    l: "#d8e0ff",
    a: "#7a4ec8",
    c: "#9ee8ff",
    e: "#1a1a4a",
    m: "#c8b8ff",
    n: "#b8c4ff",
  },
  grid: [
    ".oo........oo...",
    ".obo......obo...",
    "..obooooooob....",
    "..obbbbbbbbbo...",
    ".obllllbllllbo..",
    ".oblellblelbo...",
    ".obllllnllllbo..",
    "..obbbnnnbbbo...",
    ".oabbbbbbbbbao..",
    "oaabbooooobbaao.",
    "oaabocccccobaao.",
    ".oabocoocobbao..",
    "..oabooooobao...",
    "...ooooooooo....",
  ],
};

const stableMageAnimations: AnimationSet = {
  idle: {
    fps: 3,
    loop: true,
    frames: [
      { legs: "stand" },
      { legs: "stand", dy: 0.5 },
      { legs: "stand" },
      { legs: "stand", eyes: "closed" },
    ],
  },
  walk: {
    fps: 6,
    loop: true,
    frames: [
      { legs: "stepA" },
      { legs: "stand" },
      { legs: "stepB" },
      { legs: "stand" },
    ],
  },
  run: {
    fps: 12,
    loop: true,
    frames: [
      { legs: "stepA" },
      { legs: "spread" },
      { legs: "stepB" },
      { legs: "tuck" },
    ],
  },
  jump: {
    fps: 8,
    loop: true,
    frames: [
      { legs: "down", dy: 1 },
      { legs: "tuck", dy: -2 },
      { legs: "tuck", dy: -3 },
      { legs: "spread", dy: -2 },
      { legs: "down", dy: 1 },
    ],
  },
  hurt: {
    fps: 10,
    loop: true,
    frames: [
      { legs: "spread", eyes: "hurt", dx: -1, fx: "flash" },
      { legs: "spread", eyes: "hurt", dx: 1 },
      { legs: "stand", eyes: "hurt", fx: "flash" },
    ],
  },
  victory: {
    fps: 6,
    loop: true,
    frames: [
      { legs: "down", eyes: "happy", dy: 1 },
      { legs: "tuck", eyes: "happy", dy: -2, fx: "sparkle" },
      { legs: "stand", eyes: "happy", fx: "sparkle" },
    ],
  },
  defeat: {
    fps: 4,
    loop: false,
    frames: [
      { legs: "stand", eyes: "hurt" },
      { legs: "spread", eyes: "hurt", dy: 1 },
      { legs: "spread", eyes: "closed", dy: 2 },
      { legs: "spread", eyes: "closed", dy: 3, fx: "stars" },
    ],
  },
};

const capybara: GameplaySpriteDefinition = {
  characterId: "calm-capybara-mage",
  legColumns: [5, 9],
  palette: {
    o: "#3b241d",
    b: "#a96848",
    l: "#d99a63",
    a: "#477143",
    c: "#9bcf55",
    e: "#2a1730",
    m: "#f6d36b",
    n: "#5b3025",
  },
  grid: [
    ".....o..o.......",
    "....obb...bbo...",
    "...obbbbbbbbo...",
    "..obbbbbbbbbbo..",
    ".obbeebbbebbbbo.",
    ".obbbbnllnbbbbo.",
    "..obllllllllbo..",
    "...obllllbbo....",
    "....oaaaaao.....",
    "...oaacccaaao...",
    "..oaaaaaaaaao...",
    "..oaaallaaao....",
    "...oaaaaaaao....",
    "....oo..oo......",
  ],
  animations: stableMageAnimations,
};

const axolotl: GameplaySpriteDefinition = {
  characterId: "axolotl-mage",
  legColumns: [5, 9],
  palette: {
    o: "#3b1d4f",
    b: "#f18bb8",
    l: "#ffd2e8",
    a: "#7a6bd1",
    c: "#9eeaff",
    e: "#25163d",
    m: "#b8f5ff",
    n: "#c95b8d",
  },
  grid: [
    "......o..o......",
    ".....obbbbo.....",
    "....obbbbbbo....",
    "..ccobbbbbo..cc.",
    ".cobebebbo...c..",
    "cobbbllllboc....",
    ".cobllllboc.....",
    "..collllooc.....",
    "...oaaaaaaaao...",
    "..oaacccaaao....",
    "..oaaaaaaaaao...",
    "...oaaaaaaao....",
    "....oaaaoaa.....",
    "....oo..oo......",
  ],
  animations: stableMageAnimations,
};

export const gameplaySprites: Partial<Record<PlayableCharacterId, GameplaySpriteDefinition>> = {
  "white-fox-ice-mage": fox,
  "purple-rabbit-ninja": rabbit,
  "swamp-frog-mage": frog,
  "forge-raccoon-mage": raccoon,
  "time-owl-mage": owl,
  "calm-capybara-mage": capybara,
  "axolotl-mage": axolotl,
};

export function getGameplaySprite(id: PlayableCharacterId) {
  return gameplaySprites[id];
}

/** Resolves an animation: character override first, then shared base animation. */
export function getAnimation(
  id: PlayableCharacterId,
  state: AnimationState,
): SpriteAnimation | undefined {
  const overrides: AnimationSet = gameplaySprites[id]?.animations ?? {};
  return overrides[state] ?? baseAnimations[state];
}
