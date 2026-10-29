import { DIRECTION_VECTOR, OPPOSITE_DIRECTION } from "./config";
import type { MazeCell, MazeDirection, MazeTile } from "./types";

const DIRECTIONS: MazeDirection[] = ["up", "right", "down", "left"];

export function canEnterTile(tile: MazeTile | undefined, allowBreakable = false) {
  return tile !== undefined && tile !== "wall" && (allowBreakable || tile !== "breakable");
}

export function cellFromPosition(x: number, y: number): MazeCell {
  return { x: Math.floor(x), y: Math.floor(y) };
}

export function cellKey(cell: MazeCell) {
  return `${cell.x},${cell.y}`;
}

export function manhattanDistance(left: MazeCell, right: MazeCell) {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

export function getNeighbors(
  grid: MazeTile[][],
  cell: MazeCell,
  allowBreakable = false,
): { cell: MazeCell; direction: MazeDirection }[] {
  return DIRECTIONS.flatMap((direction) => {
    const vector = DIRECTION_VECTOR[direction];
    const next = { x: cell.x + vector.x, y: cell.y + vector.y };
    return canEnterTile(grid[next.y]?.[next.x], allowBreakable) ? [{ cell: next, direction }] : [];
  });
}

export function findPathDirection(
  grid: MazeTile[][],
  start: MazeCell,
  target: MazeCell,
  preferredDirection?: MazeDirection,
): MazeDirection | null {
  if (start.x === target.x && start.y === target.y) return null;
  const queue: MazeCell[] = [target];
  const nextStep = new Map<string, { from: MazeCell; direction: MazeDirection }>();
  const visited = new Set<string>([cellKey(target)]);

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]!;
    for (const neighbor of getNeighbors(grid, current)) {
      const key = cellKey(neighbor.cell);
      if (visited.has(key)) continue;
      visited.add(key);
      // Stored direction points from the neighbor back toward the cell closer to the target.
      const towardCurrent = OPPOSITE_DIRECTION[neighbor.direction];
      nextStep.set(key, { from: current, direction: towardCurrent });
      queue.push(neighbor.cell);
    }
  }

  const first = nextStep.get(cellKey(start));
  if (!first) return null;
  if (preferredDirection === first.direction) return preferredDirection;
  return first.direction;
}

export function chooseFleeDirection(
  grid: MazeTile[][],
  from: MazeCell,
  threat: MazeCell,
  preferredDirection?: MazeDirection,
): MazeDirection | null {
  const options = getNeighbors(grid, from);
  options.sort((left, right) => {
    const leftDistance = manhattanDistance(left.cell, threat);
    const rightDistance = manhattanDistance(right.cell, threat);
    const leftPreference = left.direction === preferredDirection ? 0.2 : 0;
    const rightPreference = right.direction === preferredDirection ? 0.2 : 0;
    return rightDistance + rightPreference - (leftDistance + leftPreference);
  });
  return options[0]?.direction ?? null;
}

export function getReachableCells(grid: MazeTile[][], start: MazeCell) {
  const result: MazeCell[] = [];
  const queue: MazeCell[] = [start];
  const visited = new Set<string>([cellKey(start)]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]!;
    result.push(current);
    for (const neighbor of getNeighbors(grid, current)) {
      const key = cellKey(neighbor.cell);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push(neighbor.cell);
    }
  }
  return result;
}
