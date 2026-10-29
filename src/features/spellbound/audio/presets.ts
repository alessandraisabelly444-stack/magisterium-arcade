import type { ArcadeSfx } from "./types";

export interface ArcadeTone {
  frequency: number;
  duration: number;
  offset: number;
  waveform: OscillatorType;
  gain: number;
  endFrequency?: number;
}

export interface ArcadeSfxPreset {
  tones: readonly ArcadeTone[];
  cooldownMs: number;
  priority: "ui" | "pickup" | "important";
  duckMusic?: boolean;
}

function sequence(
  notes: readonly number[],
  duration: number,
  waveform: OscillatorType,
  gain: number,
  spacing = duration * 0.72,
): ArcadeTone[] {
  return notes.map((frequency, index) => ({
    frequency,
    duration,
    offset: index * spacing,
    waveform,
    gain,
  }));
}

export const ARCADE_SFX: Record<ArcadeSfx, ArcadeSfxPreset> = {
  "ui-hover": {
    tones: [
      {
        frequency: 660,
        endFrequency: 790,
        duration: 0.045,
        offset: 0,
        waveform: "square",
        gain: 0.11,
      },
    ],
    cooldownMs: 65,
    priority: "ui",
  },
  "ui-click": {
    tones: [
      {
        frequency: 690,
        endFrequency: 510,
        duration: 0.075,
        offset: 0,
        waveform: "square",
        gain: 0.2,
      },
    ],
    cooldownMs: 35,
    priority: "ui",
  },
  "ui-confirm": {
    tones: sequence([587, 784], 0.09, "triangle", 0.2, 0.055),
    cooldownMs: 50,
    priority: "ui",
  },
  "ui-back": {
    tones: sequence([520, 392], 0.085, "triangle", 0.17, 0.045),
    cooldownMs: 70,
    priority: "ui",
  },
  "menu-open": {
    tones: sequence([440, 554, 698], 0.085, "triangle", 0.17, 0.05),
    cooldownMs: 60,
    priority: "ui",
  },
  "menu-close": {
    tones: sequence([698, 554, 440], 0.075, "triangle", 0.15, 0.045),
    cooldownMs: 60,
    priority: "ui",
  },
  "game-start": {
    tones: sequence([523, 659, 784, 1047], 0.12, "triangle", 0.24, 0.085),
    cooldownMs: 160,
    priority: "important",
    duckMusic: true,
  },
  countdown: {
    tones: [
      { frequency: 660, duration: 0.12, offset: 0, waveform: "square", gain: 0.21 },
      { frequency: 880, duration: 0.18, offset: 0.28, waveform: "square", gain: 0.24 },
    ],
    cooldownMs: 120,
    priority: "important",
    duckMusic: true,
  },
  flap: {
    tones: [
      {
        frequency: 620,
        endFrequency: 760,
        duration: 0.06,
        offset: 0,
        waveform: "triangle",
        gain: 0.15,
      },
    ],
    cooldownMs: 55,
    priority: "pickup",
  },
  jump: {
    tones: [
      {
        frequency: 220,
        endFrequency: 620,
        duration: 0.12,
        offset: 0,
        waveform: "triangle",
        gain: 0.2,
      },
    ],
    cooldownMs: 85,
    priority: "pickup",
  },
  "piece-drop": {
    tones: [
      {
        frequency: 340,
        endFrequency: 145,
        duration: 0.15,
        offset: 0,
        waveform: "triangle",
        gain: 0.23,
      },
      {
        frequency: 185,
        endFrequency: 115,
        duration: 0.1,
        offset: 0.08,
        waveform: "sine",
        gain: 0.12,
      },
    ],
    cooldownMs: 80,
    priority: "pickup",
  },
  score: {
    tones: sequence([880, 1175], 0.065, "square", 0.14, 0.05),
    cooldownMs: 220,
    priority: "pickup",
  },
  record: {
    tones: sequence([659, 784, 988, 1319, 1568], 0.15, "triangle", 0.26, 0.095),
    cooldownMs: 300,
    priority: "important",
    duckMusic: true,
  },
  lose: {
    tones: sequence([523, 440, 349, 262], 0.16, "triangle", 0.23, 0.12),
    cooldownMs: 260,
    priority: "important",
    duckMusic: true,
  },
  win: {
    tones: sequence([523, 659, 784, 1047, 1319], 0.15, "triangle", 0.24, 0.09),
    cooldownMs: 300,
    priority: "important",
    duckMusic: true,
  },
  "level-clear": {
    tones: sequence([659, 784, 988, 1175], 0.13, "triangle", 0.23, 0.085),
    cooldownMs: 260,
    priority: "important",
    duckMusic: true,
  },
  coin: {
    tones: [
      { frequency: 988, duration: 0.075, offset: 0, waveform: "sine", gain: 0.22 },
      { frequency: 1480, duration: 0.11, offset: 0.045, waveform: "triangle", gain: 0.18 },
    ],
    cooldownMs: 150,
    priority: "pickup",
  },
  collect: {
    tones: sequence([659, 784, 988], 0.075, "triangle", 0.18, 0.055),
    cooldownMs: 90,
    priority: "pickup",
  },
  "rune-spawn": {
    tones: [
      { frequency: 587, duration: 0.14, offset: 0, waveform: "sine", gain: 0.1 },
      { frequency: 880, duration: 0.19, offset: 0.11, waveform: "triangle", gain: 0.12 },
    ],
    cooldownMs: 650,
    priority: "pickup",
  },
  rune: {
    tones: sequence([523, 659, 784, 1047, 1319], 0.13, "sine", 0.22, 0.072),
    cooldownMs: 220,
    priority: "important",
    duckMusic: true,
  },
  "power-ice": {
    tones: [
      { frequency: 784, duration: 0.14, offset: 0, waveform: "triangle", gain: 0.2 },
      {
        frequency: 1175,
        endFrequency: 1760,
        duration: 0.22,
        offset: 0.045,
        waveform: "sine",
        gain: 0.21,
      },
      { frequency: 1568, duration: 0.16, offset: 0.13, waveform: "sine", gain: 0.12 },
    ],
    cooldownMs: 220,
    priority: "important",
    duckMusic: true,
  },
  "power-teleport": {
    tones: [
      {
        frequency: 988,
        endFrequency: 220,
        duration: 0.2,
        offset: 0,
        waveform: "sawtooth",
        gain: 0.16,
      },
      {
        frequency: 660,
        endFrequency: 1320,
        duration: 0.13,
        offset: 0.11,
        waveform: "triangle",
        gain: 0.18,
      },
      { frequency: 1319, duration: 0.07, offset: 0.21, waveform: "sine", gain: 0.13 },
    ],
    cooldownMs: 220,
    priority: "important",
    duckMusic: true,
  },
  "power-shuriken": {
    tones: [
      {
        frequency: 1760,
        endFrequency: 740,
        duration: 0.12,
        offset: 0,
        waveform: "sawtooth",
        gain: 0.17,
      },
      {
        frequency: 1320,
        endFrequency: 520,
        duration: 0.1,
        offset: 0.04,
        waveform: "triangle",
        gain: 0.13,
      },
      { frequency: 1047, duration: 0.055, offset: 0.11, waveform: "square", gain: 0.12 },
    ],
    cooldownMs: 200,
    priority: "important",
    duckMusic: true,
  },
  "power-time": {
    tones: [
      { frequency: 392, endFrequency: 784, duration: 0.28, offset: 0, waveform: "sine", gain: 0.2 },
      {
        frequency: 587,
        endFrequency: 440,
        duration: 0.3,
        offset: 0.08,
        waveform: "triangle",
        gain: 0.13,
      },
      { frequency: 1175, duration: 0.16, offset: 0.19, waveform: "sine", gain: 0.12 },
    ],
    cooldownMs: 220,
    priority: "important",
    duckMusic: true,
  },
  "power-swamp": {
    tones: [
      {
        frequency: 250,
        endFrequency: 360,
        duration: 0.11,
        offset: 0,
        waveform: "sine",
        gain: 0.22,
      },
      {
        frequency: 370,
        endFrequency: 490,
        duration: 0.12,
        offset: 0.09,
        waveform: "triangle",
        gain: 0.19,
      },
      { frequency: 740, duration: 0.09, offset: 0.17, waveform: "sine", gain: 0.11 },
    ],
    cooldownMs: 220,
    priority: "important",
    duckMusic: true,
  },
  "power-forge": {
    tones: [
      {
        frequency: 330,
        endFrequency: 660,
        duration: 0.16,
        offset: 0,
        waveform: "sawtooth",
        gain: 0.17,
      },
      {
        frequency: 660,
        endFrequency: 990,
        duration: 0.13,
        offset: 0.09,
        waveform: "square",
        gain: 0.14,
      },
      { frequency: 880, duration: 0.1, offset: 0.18, waveform: "triangle", gain: 0.14 },
    ],
    cooldownMs: 220,
    priority: "important",
    duckMusic: true,
  },
  blocked: {
    tones: [
      {
        frequency: 220,
        endFrequency: 150,
        duration: 0.1,
        offset: 0,
        waveform: "square",
        gain: 0.17,
      },
      { frequency: 130, duration: 0.08, offset: 0.06, waveform: "triangle", gain: 0.13 },
    ],
    cooldownMs: 170,
    priority: "pickup",
  },
  "cooldown-ready": {
    tones: sequence([659, 880, 1175], 0.075, "sine", 0.15, 0.055),
    cooldownMs: 220,
    priority: "pickup",
  },
  hit: {
    tones: [
      {
        frequency: 295,
        endFrequency: 120,
        duration: 0.13,
        offset: 0,
        waveform: "sawtooth",
        gain: 0.2,
      },
      {
        frequency: 185,
        endFrequency: 95,
        duration: 0.1,
        offset: 0.025,
        waveform: "triangle",
        gain: 0.11,
      },
    ],
    cooldownMs: 100,
    priority: "important",
    duckMusic: true,
  },
  "life-lost": {
    tones: sequence([392, 311, 233], 0.16, "triangle", 0.22, 0.13),
    cooldownMs: 220,
    priority: "important",
    duckMusic: true,
  },
  "game-over": {
    tones: sequence([440, 349, 294, 220], 0.2, "triangle", 0.25, 0.14),
    cooldownMs: 300,
    priority: "important",
    duckMusic: true,
  },
  "exit-unlocked": {
    tones: sequence([523, 659, 784, 1047], 0.12, "sine", 0.2, 0.075),
    cooldownMs: 250,
    priority: "important",
    duckMusic: true,
  },
  "ghost-near": {
    tones: [
      { frequency: 165, duration: 0.12, offset: 0, waveform: "sine", gain: 0.12 },
      { frequency: 132, duration: 0.14, offset: 0.2, waveform: "sine", gain: 0.1 },
    ],
    cooldownMs: 5000,
    priority: "pickup",
  },
};
