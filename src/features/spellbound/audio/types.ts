export type ArcadeTrack = "lobby" | "tower" | "sky-flap" | "sky-run" | "maze";

export type ArcadeSfx =
  | "ui-hover"
  | "ui-click"
  | "ui-confirm"
  | "ui-back"
  | "menu-open"
  | "menu-close"
  | "game-start"
  | "countdown"
  | "flap"
  | "jump"
  | "piece-drop"
  | "score"
  | "record"
  | "lose"
  | "win"
  | "level-clear"
  | "coin"
  | "collect"
  | "rune-spawn"
  | "rune"
  | "power-ice"
  | "power-teleport"
  | "power-shuriken"
  | "power-time"
  | "power-swamp"
  | "power-forge"
  | "blocked"
  | "cooldown-ready"
  | "hit"
  | "life-lost"
  | "game-over"
  | "exit-unlocked"
  | "ghost-near";

export interface ArcadeAudioSettings {
  musicVolume: number;
  sfxVolume: number;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  silentMode: boolean;
}

export interface ArcadeSfxOptions {
  volume?: number;
  pitch?: number;
}
