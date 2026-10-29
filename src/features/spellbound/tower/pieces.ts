export type TetrominoType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

export const TETROMINO_TYPES: TetrominoType[] = ["I", "O", "T", "S", "Z", "J", "L"];

/** Cell coordinates (x, y) of each classic tetromino. */
export const TETROMINO_SHAPES: Record<TetrominoType, [number, number][]> = {
  I: [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ],
  O: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  T: [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
  ],
  S: [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
  Z: [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  J: [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  L: [
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
};

/** Pixel-art block colors: [fill, light, shadow]. */
export const TETROMINO_COLORS: Record<TetrominoType, [string, string, string]> = {
  I: ["#5ee6ff", "#c9f7ff", "#2a9cc4"],
  O: ["#ff8ad8", "#ffd0f0", "#c24fa0"],
  T: ["#b58cff", "#e2d2ff", "#7a52d0"],
  S: ["#6ee7b7", "#c8f8e4", "#2fa77c"],
  Z: ["#ff7a9a", "#ffc6d4", "#c2466a"],
  J: ["#5a86ff", "#c4d4ff", "#2f52c4"],
  L: ["#3fd0c8", "#b8f2ee", "#1f8f8a"],
};

/** 7-bag randomizer so every piece appears regularly. */
export function createBag() {
  let bag: TetrominoType[] = [];
  return () => {
    if (bag.length === 0) {
      bag = [...TETROMINO_TYPES].sort(() => Math.random() - 0.5);
    }
    return bag.pop()!;
  };
}
