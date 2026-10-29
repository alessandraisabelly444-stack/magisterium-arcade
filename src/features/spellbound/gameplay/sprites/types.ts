import type { PlayableCharacterId } from "../../types";

/** Every animation state a gameplay character can have. */
export type AnimationState =
  "idle" | "walk" | "run" | "jump" | "hurt" | "victory" | "defeat" | "ability";

/** Animation states implemented right now (ability comes with the abilities system). */
export const BASIC_ANIMATION_STATES: AnimationState[] = [
  "idle",
  "walk",
  "run",
  "jump",
  "hurt",
  "victory",
  "defeat",
];

export type LegPose = "stand" | "stepA" | "stepB" | "tuck" | "spread" | "down";
export type EyePose = "open" | "closed" | "hurt" | "happy";

/** A single frame: a pose applied on top of the character's base pixel grid. */
export interface SpriteFrame {
  dx?: number;
  dy?: number;
  scaleX?: number;
  scaleY?: number;
  rotate?: number;
  legs?: LegPose;
  eyes?: EyePose;
  /** Optional overlay effect (sparkles, flash). */
  fx?: "sparkle" | "flash" | "stars";
}

export interface SpriteAnimation {
  frames: SpriteFrame[];
  fps: number;
  loop: boolean;
}

export type AnimationSet = Partial<Record<AnimationState, SpriteAnimation>>;

/** Palette keys used in pixel grids. "." = transparent. */
export type PaletteKey = "o" | "b" | "l" | "a" | "c" | "e" | "m" | "n";

export interface GameplaySpriteDefinition {
  characterId: PlayableCharacterId;
  /** 16 columns x 14 rows body grid (legs are generated from the pose). */
  grid: string[];
  palette: Record<PaletteKey, string>;
  /** Leg columns [left, right] start x. */
  legColumns: [number, number];
  /** Per-character animation overrides (e.g. a future "ability" animation). */
  animations?: AnimationSet;
}
