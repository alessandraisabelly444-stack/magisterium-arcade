import type { MazeBiomeDefinition, MazeDirection } from "./types";

export const MAZE_COLUMNS = 25;
export const MAZE_ROWS = 17;
export const MAZE_TILE_SIZE = 32;
export const MAZE_WIDTH = MAZE_COLUMNS * MAZE_TILE_SIZE;
export const MAZE_HEIGHT = MAZE_ROWS * MAZE_TILE_SIZE;
export const MAZE_VOTE_SECONDS = 10;
export const MAZE_PLAYER_KEYS = ["ShiftLeft", "KeyZ", "ShiftRight", "Slash"] as const;
export const MAZE_TEAM_SIZE = 3;
export const MAZE_SWITCH_COOLDOWN_SECONDS = 0.65;
export const MAZE_POWER_COOLDOWN_SECONDS = 20;
export const MAZE_POWER_RUNES_PER_LEVEL = 3;
export const MAZE_POWER_RUNE_WARNING_SECONDS = 1.8;
export const MAZE_MULTIPLAYER_EXTRA_GHOSTS = 2;
export const MAZE_TELEPORT_RANGE = 6;
export const MAZE_RESPAWN_PROTECTION_SECONDS = 5;
export const MAZE_CHARACTER_SWITCH_KEYS = [
  ["Digit1", "Digit2", "Digit3"],
  ["KeyQ", "KeyE", "KeyR"],
  ["KeyU", "KeyO", "KeyP"],
  ["KeyV", "KeyB", "KeyN"],
] as const;

export const DIRECTION_VECTOR: Record<MazeDirection, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const OPPOSITE_DIRECTION: Record<MazeDirection, MazeDirection> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export const MAZE_BIOMES: readonly MazeBiomeDefinition[] = [
  {
    id: "frost",
    name: "OBSERVATÓRIO GLACIAL",
    subtitle: "Passagens de cristal e espelhos de gelo",
    wall: "#345d9a",
    wallLight: "#8edaf2",
    floor: "#142b52",
    floorAlt: "#1a3764",
    accent: "#b8f5ff",
    glow: "#70ddff",
    special: "#70dff1",
    specialName: "GELO BRILHANTE",
    specialRule: "As placas de gelo reduzem o passo dos espíritos.",
  },
  {
    id: "shadow-garden",
    name: "JARDIM DAS SOMBRAS",
    subtitle: "Bambuzais lunares e atalhos ocultos",
    wall: "#543975",
    wallLight: "#c88cf3",
    floor: "#24153d",
    floorAlt: "#321c50",
    accent: "#e0afff",
    glow: "#bd75f2",
    special: "#ad70dc",
    specialName: "PASSAGEM SOMBRIA",
    specialRule: "Fendas de sombra escondem caminhos alternativos.",
  },
  {
    id: "mosswood",
    name: "PÂNTANO DAS RAÍZES",
    subtitle: "Musgo vivo, poças e portões de cipó",
    wall: "#35644e",
    wallLight: "#a9df82",
    floor: "#142f2c",
    floorAlt: "#1c4035",
    accent: "#c1f08f",
    glow: "#8ee7a0",
    special: "#73c878",
    specialName: "MUSGO VIVO",
    specialRule: "O musgo prende por instantes os espíritos que o cruzam.",
  },
  {
    id: "forge",
    name: "FORJA DAS ESTRELAS",
    subtitle: "Pedra quente, veios de magma e blocos rachados",
    wall: "#78434b",
    wallLight: "#ffad73",
    floor: "#3b202c",
    floorAlt: "#4c2931",
    accent: "#ffd293",
    glow: "#ff744a",
    special: "#f79456",
    specialName: "BRASA RÚNICA",
    specialRule: "As brasas rúnicas iluminam o caminho e destacam paredes rachadas.",
  },
  {
    id: "chronolibrary",
    name: "BIBLIOTECA DO TEMPO",
    subtitle: "Relógios suspensos e estantes de runas",
    wall: "#394986",
    wallLight: "#b7baff",
    floor: "#1a2145",
    floorAlt: "#252b59",
    accent: "#d0ceff",
    glow: "#9e9aff",
    special: "#8f93ff",
    specialName: "ECO TEMPORAL",
    specialRule: "Ecos temporais atrasam a perseguição dos espíritos.",
  },
] as const;

export const GHOST_KIND_NAMES = {
  pursuer: "PERSEGUIDOR",
  interceptor: "ESTRATEGISTA",
  patroller: "PATRULHEIRO",
  trickster: "IMPREVISÍVEL",
} as const;

export const LOCAL_PLAYER_CONTROLS = [
  { movement: "SETAS", ability: "SHIFT ESQ.", switch: "1 / 2 / 3" },
  { movement: "W A S D", ability: "Z", switch: "Q / E / R" },
  { movement: "I J K L", ability: "SHIFT DIR.", switch: "U / O / P" },
  { movement: "T F G H", ability: "/", switch: "V / B / N" },
] as const;

export const MAX_LOCAL_PLAYERS = 4;
export const MIN_LOCAL_PLAYERS = 2;
export const MAX_SOLO_LIVES = 5;
export const INITIAL_SOLO_LIVES = 3;
export const INITIAL_MULTIPLAYER_LIVES = 2;
export const RESULTS_DISPLAY_SECONDS = 2.4;
export const DECISION_DISPLAY_SECONDS = 2.2;
export const MAX_MULTIPLAYER_MATCH_SECONDS = 180;
