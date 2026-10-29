import type { AnimationSet } from "./types";

/** Shared basic animations. Characters may override any of them. */
export const baseAnimations: AnimationSet = {
  idle: {
    fps: 3,
    loop: true,
    frames: [
      { legs: "stand" },
      { legs: "stand", dy: 0.5, scaleY: 0.97 },
      { legs: "stand" },
      { legs: "stand", eyes: "closed" },
    ],
  },
  walk: {
    fps: 6,
    loop: true,
    frames: [
      { legs: "stepA" },
      { legs: "stand", dy: -0.5 },
      { legs: "stepB" },
      { legs: "stand", dy: -0.5 },
    ],
  },
  run: {
    fps: 12,
    loop: true,
    frames: [
      { legs: "stepA", rotate: 8, dy: -1 },
      { legs: "spread", rotate: 8, dy: -2 },
      { legs: "stepB", rotate: 8, dy: -1 },
      { legs: "tuck", rotate: 8 },
    ],
  },
  jump: {
    fps: 8,
    loop: true,
    frames: [
      { legs: "down", scaleY: 0.85, scaleX: 1.1, dy: 1 },
      { legs: "tuck", dy: -4, scaleY: 1.1 },
      { legs: "tuck", dy: -6 },
      { legs: "spread", dy: -5 },
      { legs: "spread", dy: -2 },
      { legs: "down", scaleY: 0.9, scaleX: 1.08, dy: 1 },
    ],
  },
  hurt: {
    fps: 10,
    loop: true,
    frames: [
      { legs: "spread", eyes: "hurt", dx: -1.5, rotate: -10, fx: "flash" },
      { legs: "spread", eyes: "hurt", dx: 1, rotate: -6 },
      { legs: "spread", eyes: "hurt", dx: -1, rotate: -8, fx: "flash" },
      { legs: "stand", eyes: "hurt" },
      { legs: "stand", eyes: "hurt" },
    ],
  },
  victory: {
    fps: 6,
    loop: true,
    frames: [
      { legs: "down", eyes: "happy", scaleY: 0.9, dy: 1 },
      { legs: "tuck", eyes: "happy", dy: -4, fx: "sparkle" },
      { legs: "tuck", eyes: "happy", dy: -5, rotate: 10, fx: "sparkle" },
      { legs: "tuck", eyes: "happy", dy: -4, rotate: -10, fx: "sparkle" },
      { legs: "stand", eyes: "happy" },
    ],
  },
  defeat: {
    fps: 4,
    loop: false,
    frames: [
      { legs: "stand", eyes: "hurt" },
      { legs: "spread", eyes: "hurt", rotate: -20, dy: 1 },
      { legs: "spread", eyes: "closed", rotate: -60, dy: 3 },
      { legs: "spread", eyes: "closed", rotate: -90, dy: 4, fx: "stars" },
    ],
  },
};
