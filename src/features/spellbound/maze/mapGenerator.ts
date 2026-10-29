import {
  MAZE_BIOMES,
  MAZE_COLUMNS,
  MAZE_MULTIPLAYER_EXTRA_GHOSTS,
  MAZE_POWER_RUNES_PER_LEVEL,
  MAZE_ROWS,
} from "./config";
import type { MazeBiomeDefinition, MazeCell, MazeItem, MazeLayout, MazeTile } from "./types";

const CARVE_DIRECTIONS = [
  { x: 0, y: -2 },
  { x: 2, y: 0 },
  { x: 0, y: 2 },
  { x: -2, y: 0 },
] as const;
const CARDINAL_DIRECTIONS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const;

function makeRandom(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other]!, result[index]!];
  }
  return result;
}

function inBounds(x: number, y: number) {
  return x > 0 && y > 0 && x < MAZE_COLUMNS - 1 && y < MAZE_ROWS - 1;
}

function isWalkable(tile: MazeTile | undefined) {
  return tile !== undefined && tile !== "wall" && tile !== "breakable";
}

function distancesFrom(grid: MazeTile[][], start: MazeCell) {
  const distances = new Map<string, number>();
  const queue: MazeCell[] = [start];
  distances.set(`${start.x},${start.y}`, 0);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const cell = queue[cursor]!;
    const nextDistance = distances.get(`${cell.x},${cell.y}`)! + 1;
    for (const direction of CARDINAL_DIRECTIONS) {
      const x = cell.x + direction.x;
      const y = cell.y + direction.y;
      const key = `${x},${y}`;
      if (!isWalkable(grid[y]?.[x]) || distances.has(key)) continue;
      distances.set(key, nextDistance);
      queue.push({ x, y });
    }
  }
  return distances;
}

function createOpenMaze(random: () => number, difficultyRank: number) {
  const grid: MazeTile[][] = Array.from({ length: MAZE_ROWS }, () =>
    Array.from({ length: MAZE_COLUMNS }, () => "wall" as MazeTile),
  );
  const stack: MazeCell[] = [{ x: 1, y: 1 }];
  grid[1]![1] = "path";

  while (stack.length > 0) {
    const current = stack[stack.length - 1]!;
    const options = shuffle(
      CARVE_DIRECTIONS as unknown as { x: number; y: number }[],
      random,
    ).filter((direction) => {
      const x = current.x + direction.x;
      const y = current.y + direction.y;
      return inBounds(x, y) && grid[y]?.[x] === "wall";
    });
    const next = options[0];
    if (!next) {
      stack.pop();
      continue;
    }
    grid[current.y + next.y / 2]![current.x + next.x / 2] = "path";
    grid[current.y + next.y]![current.x + next.x] = "path";
    stack.push({ x: current.x + next.x, y: current.y + next.y });
  }

  // Give the entrance a real staging chamber instead of a single-cell starting corridor.
  for (let y = 1; y <= 3; y += 1) {
    for (let x = 1; x <= 3; x += 1) grid[y]![x] = "path";
  }

  // Handcrafted room pockets create readable open arenas inside the maze's winding corridors.
  const roomCenters: MazeCell[] = [];
  for (let y = 3; y < MAZE_ROWS - 2; y += 2) {
    for (let x = 3; x < MAZE_COLUMNS - 2; x += 2) roomCenters.push({ x, y });
  }
  const roomsToCarve = Math.min(5, 2 + Math.floor(Math.max(0, difficultyRank - 1) / 3));
  for (const center of shuffle(roomCenters, random).slice(0, roomsToCarve)) {
    for (let y = center.y - 1; y <= center.y + 1; y += 1) {
      for (let x = center.x - 1; x <= center.x + 1; x += 1) grid[y]![x] = "path";
    }
  }

  // A few extra openings make optional loops and shortcuts; the DFS corridors remain connected.
  const loopCandidates: MazeCell[] = [];
  for (let y = 1; y < MAZE_ROWS - 1; y += 1) {
    for (let x = 1; x < MAZE_COLUMNS - 1; x += 1) {
      if (grid[y]![x] !== "wall") continue;
      const horizontal = isWalkable(grid[y]?.[x - 1]) && isWalkable(grid[y]?.[x + 1]);
      const vertical = isWalkable(grid[y - 1]?.[x]) && isWalkable(grid[y + 1]?.[x]);
      if (horizontal || vertical) loopCandidates.push({ x, y });
    }
  }
  const loopsToOpen = Math.min(14, 6 + Math.floor(difficultyRank * 0.75));
  for (const cell of shuffle(loopCandidates, random).slice(0, loopsToOpen)) {
    grid[cell.y]![cell.x] = "path";
  }
  return grid;
}

function gatherCells(grid: MazeTile[][]) {
  const cells: MazeCell[] = [];
  for (let y = 1; y < MAZE_ROWS - 1; y += 1) {
    for (let x = 1; x < MAZE_COLUMNS - 1; x += 1) {
      if (isWalkable(grid[y]?.[x])) cells.push({ x, y });
    }
  }
  return cells;
}

function chooseFarthest(cells: MazeCell[], distances: Map<string, number>, excluded: MazeCell[]) {
  const excludedKeys = new Set(excluded.map((cell) => `${cell.x},${cell.y}`));
  return (
    [...cells]
      .filter((cell) => !excludedKeys.has(`${cell.x},${cell.y}`))
      .sort(
        (left, right) =>
          (distances.get(`${right.x},${right.y}`) ?? 0) -
          (distances.get(`${left.x},${left.y}`) ?? 0),
      )[0] ?? { x: MAZE_COLUMNS - 2, y: MAZE_ROWS - 2 }
  );
}

function takeSpreadOut(
  pool: MazeCell[],
  count: number,
  random: () => number,
  from?: MazeCell,
  minDistance = 0,
) {
  const remaining = shuffle(pool, random);
  const selected: MazeCell[] = [];
  if (from) {
    remaining.sort(
      (left, right) =>
        Math.abs(right.x - from.x) +
        Math.abs(right.y - from.y) -
        (Math.abs(left.x - from.x) + Math.abs(left.y - from.y)),
    );
  }
  while (selected.length < count && remaining.length > 0) {
    let bestIndex = 0;
    if (selected.length > 0 || from) {
      let bestScore = Number.NEGATIVE_INFINITY;
      for (let index = 0; index < remaining.length; index += 1) {
        const cell = remaining[index]!;
        const anchors = [...selected, ...(from ? [from] : [])];
        const nearest = anchors.length
          ? Math.min(
              ...anchors.map((anchor) => Math.abs(cell.x - anchor.x) + Math.abs(cell.y - anchor.y)),
            )
          : 0;
        const score = nearest + random() * 0.4;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      }
    }
    const [cell] = remaining.splice(bestIndex, 1);
    if (!cell) break;
    if (
      minDistance > 0 &&
      from &&
      Math.abs(cell.x - from.x) + Math.abs(cell.y - from.y) < minDistance
    ) {
      continue;
    }
    selected.push(cell);
  }
  return selected;
}

function placeOptionalBreakables(grid: MazeTile[][], random: () => number, count: number) {
  const candidates: MazeCell[] = [];
  for (let y = 2; y < MAZE_ROWS - 2; y += 1) {
    for (let x = 2; x < MAZE_COLUMNS - 2; x += 1) {
      if (grid[y]![x] !== "wall") continue;
      const horizontal = isWalkable(grid[y]?.[x - 1]) && isWalkable(grid[y]?.[x + 1]);
      const vertical = isWalkable(grid[y - 1]?.[x]) && isWalkable(grid[y + 1]?.[x]);
      if (horizontal || vertical) candidates.push({ x, y });
    }
  }
  for (const cell of shuffle(candidates, random).slice(0, count))
    grid[cell.y]![cell.x] = "breakable";
}

export function generateMazeLayout(
  level: number,
  cycle: number,
  seed: number,
  playerCount: number,
): MazeLayout {
  const levelInCycle = ((level - 1) % MAZE_BIOMES.length) + 1;
  const biome = MAZE_BIOMES[levelInCycle - 1] as MazeBiomeDefinition;
  const difficultyRank = Math.max(1, level + cycle - 1);
  const levelSeed = (seed ^ Math.imul(level, 0x9e3779b1) ^ Math.imul(cycle, 0x85ebca6b)) >>> 0;
  const random = makeRandom(levelSeed);
  const grid = createOpenMaze(random, difficultyRank);
  const start = { x: 1, y: 1 };
  const distances = distancesFrom(grid, start);
  const walkable = gatherCells(grid);
  const exit = chooseFarthest(walkable, distances, [start]);

  const playerSpawns = [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
  ].slice(0, Math.max(1, Math.min(4, playerCount)));

  placeOptionalBreakables(grid, random, Math.min(3, 1 + Math.floor(difficultyRank / 5)));
  const reachableAfterBreakables = distancesFrom(grid, start);
  const safeCells = gatherCells(grid).filter(
    (cell) =>
      reachableAfterBreakables.has(`${cell.x},${cell.y}`) &&
      Math.abs(cell.x - start.x) + Math.abs(cell.y - start.y) > 4 &&
      Math.abs(cell.x - exit.x) + Math.abs(cell.y - exit.y) > 1 &&
      !playerSpawns.some((spawn) => spawn.x === cell.x && spawn.y === cell.y),
  );

  const isMultiplayer = playerCount > 1;
  const ghostCount = Math.min(
    isMultiplayer ? 8 : 6,
    2 + Math.floor((difficultyRank - 1) / 3) + (isMultiplayer ? MAZE_MULTIPLAYER_EXTRA_GHOSTS : 0),
  );
  const ghostSpawns = takeSpreadOut(safeCells, ghostCount, random, exit, 5);
  const used = new Set([
    ...playerSpawns.map((cell) => `${cell.x},${cell.y}`),
    `${exit.x},${exit.y}`,
    ...ghostSpawns.map((cell) => `${cell.x},${cell.y}`),
  ]);
  const itemCandidates = safeCells.filter((cell) => !used.has(`${cell.x},${cell.y}`));
  const targetCrystals = Math.min(12, 6 + Math.floor((difficultyRank - 1) / 3));
  const targetRunes = 2;
  const crystalCells = takeSpreadOut(itemCandidates, targetCrystals + 4, random, start, 4);
  for (const cell of crystalCells) used.add(`${cell.x},${cell.y}`);
  const runePool = itemCandidates.filter((cell) => !used.has(`${cell.x},${cell.y}`));
  const runeCells = takeSpreadOut(runePool, targetRunes, random, exit, 4);
  for (const cell of runeCells) used.add(`${cell.x},${cell.y}`);

  const coinPool = itemCandidates.filter((cell) => !used.has(`${cell.x},${cell.y}`));
  const coinCells = takeSpreadOut(coinPool, Math.min(16, coinPool.length), random, start, 3);
  for (const cell of coinCells) used.add(`${cell.x},${cell.y}`);
  const powerRunePool = itemCandidates.filter((cell) => !used.has(`${cell.x},${cell.y}`));
  const powerRuneCells = takeSpreadOut(powerRunePool, MAZE_POWER_RUNES_PER_LEVEL, random, start, 3);
  for (const cell of powerRuneCells) used.add(`${cell.x},${cell.y}`);
  const specialPool = gatherCells(grid).filter(
    (cell) =>
      !used.has(`${cell.x},${cell.y}`) &&
      Math.abs(cell.x - start.x) + Math.abs(cell.y - start.y) > 2,
  );
  const specialCells = takeSpreadOut(specialPool, 4, random, start, 2);
  for (const cell of specialCells) {
    grid[cell.y]![cell.x] = "special";
    used.add(`${cell.x},${cell.y}`);
  }

  const items: MazeItem[] = [
    ...crystalCells.map((cell, index) => ({
      id: `crystal-${level}-${index}`,
      kind: "crystal" as const,
      x: cell.x,
      y: cell.y,
      collectedBy: null,
    })),
    ...runeCells.map((cell, index) => ({
      id: `rune-${level}-${index}`,
      kind: "rune" as const,
      x: cell.x,
      y: cell.y,
      collectedBy: null,
    })),
    ...coinCells.map((cell, index) => ({
      id: `coin-${level}-${index}`,
      kind: "coin" as const,
      x: cell.x,
      y: cell.y,
      collectedBy: null,
    })),
    ...powerRuneCells.map((cell, index) => ({
      id: `power-rune-${level}-${index}`,
      kind: "power-rune" as const,
      x: cell.x,
      y: cell.y,
      collectedBy: null,
    })),
  ];

  return {
    width: MAZE_COLUMNS,
    height: MAZE_ROWS,
    biome,
    grid,
    start,
    exit,
    playerSpawns,
    ghostSpawns,
    items,
    targetCrystals,
    targetRunes,
    seed: levelSeed,
  };
}
