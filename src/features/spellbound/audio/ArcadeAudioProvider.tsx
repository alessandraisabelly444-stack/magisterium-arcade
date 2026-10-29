import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ARCADE_SFX } from "./presets";
import type { ArcadeAudioSettings, ArcadeSfx, ArcadeSfxOptions, ArcadeTrack } from "./types";

const SETTINGS_KEY = "spellbound-arcade-audio-settings-v1";
const DEFAULT_SETTINGS: ArcadeAudioSettings = {
  musicVolume: 0.26,
  sfxVolume: 0.62,
  musicEnabled: true,
  sfxEnabled: true,
  silentMode: false,
};
const MAX_ACTIVE_VOICES = 26;

type AudioContextValue = {
  settings: ArcadeAudioSettings;
  updateSettings: (patch: Partial<ArcadeAudioSettings>) => void;
  playSfx: (name: ArcadeSfx, options?: ArcadeSfxOptions) => void;
  setMusicIntensity: (intensity: number) => void;
};

const ArcadeAudioContext = createContext<AudioContextValue | null>(null);

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function musicUrlForTrack(track: ArcadeTrack) {
  if (track === "sky-run") return "/audio/music/sky-run.mp3?v=sky-run-arcade-v8";
  return `/audio/music/${track}.mp3`;
}

function readSettings(): ArcadeAudioSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object") return DEFAULT_SETTINGS;
    const value = parsed as Partial<ArcadeAudioSettings>;
    return {
      musicVolume:
        typeof value.musicVolume === "number"
          ? clamp(value.musicVolume)
          : DEFAULT_SETTINGS.musicVolume,
      sfxVolume:
        typeof value.sfxVolume === "number" ? clamp(value.sfxVolume) : DEFAULT_SETTINGS.sfxVolume,
      musicEnabled:
        typeof value.musicEnabled === "boolean"
          ? value.musicEnabled
          : DEFAULT_SETTINGS.musicEnabled,
      sfxEnabled:
        typeof value.sfxEnabled === "boolean" ? value.sfxEnabled : DEFAULT_SETTINGS.sfxEnabled,
      silentMode:
        typeof value.silentMode === "boolean" ? value.silentMode : DEFAULT_SETTINGS.silentMode,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function isSfxName(value: string): value is ArcadeSfx {
  return Object.prototype.hasOwnProperty.call(ARCADE_SFX, value);
}

function getUiTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const element = target.closest<HTMLElement>("button, a[href], [role='button']");
  if (!element || element.getAttribute("aria-disabled") === "true") return null;
  if (element instanceof HTMLButtonElement && element.disabled) return null;
  return element;
}

function uiSfxForTarget(target: HTMLElement, fallback: ArcadeSfx): ArcadeSfx {
  const requested = target.dataset["audioSfx"];
  if (requested && isSfxName(requested)) return requested;
  const accessibleLabel = [target.textContent, target.getAttribute("aria-label"), target.title]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("pt-BR");
  return /\b(voltar|back|return|cancelar|cancel)\b/i.test(accessibleLabel) ? "ui-back" : fallback;
}

interface ArcadeAudioProviderProps {
  track: ArcadeTrack | null;
  children: ReactNode;
}

export function ArcadeAudioProvider({ track, children }: ArcadeAudioProviderProps) {
  const [settings, setSettings] = useState(readSettings);
  const settingsRef = useRef(settings);
  const trackRef = useRef(track);
  const audioContextRef = useRef<AudioContext | null>(null);
  const musicElementRef = useRef<HTMLAudioElement | null>(null);
  const musicSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const sfxGainRef = useRef<GainNode | null>(null);
  const currentTrackRef = useRef<ArcadeTrack | null>(null);
  const audioUnlockedRef = useRef(false);
  const musicIntensityRef = useRef(1);
  const skyRunIntensityProgressRef = useRef(0);
  const skyRunPlaybackRateRef = useRef(1);
  const musicDuckRef = useRef(1);
  const duckTimeoutRef = useRef<number | null>(null);
  const switchTimeoutRef = useRef<number | null>(null);
  const lastSfxAtRef = useRef(new Map<ArcadeSfx, number>());
  const coinPitchStepRef = useRef(0);
  const activeVoicesRef = useRef(new Set<OscillatorNode>());
  const syncMusicRef = useRef<() => void>(() => undefined);
  const unlockAudioRef = useRef<() => void>(() => undefined);
  const playSfxRef = useRef<(name: ArcadeSfx, options?: ArcadeSfxOptions) => void>(() => undefined);

  settingsRef.current = settings;
  trackRef.current = track;

  const updateSettings = useCallback((patch: Partial<ArcadeAudioSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const rampMusicGainTo = useCallback((targetValue: number, duration = 0.18) => {
    const context = audioContextRef.current;
    const gain = musicGainRef.current;
    if (!context || !gain) return;

    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(clamp(targetValue, 0, 0.42), now + Math.max(0.025, duration));
  }, []);

  const scheduleMusicGain = useCallback(
    (duration = 0.18) => {
      const currentSettings = settingsRef.current;
      const musicElement = musicElementRef.current;
      if (musicElement) {
        if (trackRef.current === "sky-run") {
          skyRunPlaybackRateRef.current = Math.max(
            skyRunPlaybackRateRef.current,
            1 + skyRunIntensityProgressRef.current * 0.1,
          );
          musicElement.playbackRate = skyRunPlaybackRateRef.current;
        } else {
          skyRunIntensityProgressRef.current = 0;
          skyRunPlaybackRateRef.current = 1;
          musicElement.playbackRate = 1;
        }
      }
      const enabled =
        currentSettings.musicEnabled && !currentSettings.silentMode && trackRef.current !== null;
      const target = enabled
        ? clamp(
            currentSettings.musicVolume * musicIntensityRef.current * musicDuckRef.current,
            0,
            0.42,
          )
        : 0;
      rampMusicGainTo(target, duration);
    },
    [rampMusicGainTo],
  );

  const ensureAudioGraph = useCallback(() => {
    if (audioContextRef.current && musicElementRef.current) return audioContextRef.current;
    if (typeof window === "undefined" || typeof window.AudioContext === "undefined") return null;

    try {
      const context = new window.AudioContext();
      const musicElement = new Audio();
      musicElement.loop = true;
      musicElement.preload = "none";
      musicElement.volume = 1;
      const musicSource = context.createMediaElementSource(musicElement);
      const musicGain = context.createGain();
      musicGain.gain.value = 0;
      musicSource.connect(musicGain).connect(context.destination);
      const sfxGain = context.createGain();
      sfxGain.gain.value = 1;
      sfxGain.connect(context.destination);

      audioContextRef.current = context;
      musicElementRef.current = musicElement;
      musicSourceRef.current = musicSource;
      musicGainRef.current = musicGain;
      sfxGainRef.current = sfxGain;
      return context;
    } catch {
      return null;
    }
  }, []);

  const syncMusic = useCallback(() => {
    const context = audioContextRef.current;
    const musicElement = musicElementRef.current;
    if (!audioUnlockedRef.current || !context || !musicElement) return;
    if (context.state === "suspended") void context.resume().catch(() => undefined);

    if (switchTimeoutRef.current !== null) {
      window.clearTimeout(switchTimeoutRef.current);
      switchTimeoutRef.current = null;
    }

    const desiredTrack = trackRef.current;
    const audible =
      desiredTrack !== null &&
      settingsRef.current.musicEnabled &&
      !settingsRef.current.silentMode &&
      document.visibilityState !== "hidden";

    if (!audible) {
      scheduleMusicGain(0.22);
      switchTimeoutRef.current = window.setTimeout(() => {
        const stillMuted =
          !trackRef.current ||
          !settingsRef.current.musicEnabled ||
          settingsRef.current.silentMode ||
          document.visibilityState === "hidden";
        if (stillMuted) musicElement.pause();
        if (!trackRef.current) {
          currentTrackRef.current = null;
          musicElement.removeAttribute("src");
          musicElement.load();
        }
        switchTimeoutRef.current = null;
      }, 240);
      return;
    }

    if (currentTrackRef.current === desiredTrack) {
      if (musicElement.paused) {
        void musicElement
          .play()
          .then(() => scheduleMusicGain(0.28))
          .catch(() => undefined);
      } else {
        scheduleMusicGain(0.22);
      }
      return;
    }

    rampMusicGainTo(0, 0.2);
    switchTimeoutRef.current = window.setTimeout(() => {
      const nextTrack = trackRef.current;
      const stillAudible =
        nextTrack !== null &&
        settingsRef.current.musicEnabled &&
        !settingsRef.current.silentMode &&
        document.visibilityState !== "hidden";
      if (!stillAudible || !nextTrack) {
        musicElement.pause();
        switchTimeoutRef.current = null;
        return;
      }

      // A single media element is reused: the old music is faded out and paused
      // before the next source is loaded, so two background tracks never overlap.
      musicElement.pause();
      musicElement.removeAttribute("src");
      musicElement.load();
      musicElement.src = musicUrlForTrack(nextTrack);
      musicElement.currentTime = 0;
      skyRunPlaybackRateRef.current = 1;
      musicElement.playbackRate = 1;
      currentTrackRef.current = nextTrack;
      void musicElement
        .play()
        .then(() => scheduleMusicGain(0.42))
        .catch(() => {
          currentTrackRef.current = null;
        });
      switchTimeoutRef.current = null;
    }, 220);
  }, [rampMusicGainTo, scheduleMusicGain]);

  syncMusicRef.current = syncMusic;

  const unlockAudio = useCallback(() => {
    const context = ensureAudioGraph();
    if (!context) return;
    audioUnlockedRef.current = true;
    if (context.state === "suspended") void context.resume().catch(() => undefined);
    syncMusicRef.current();
  }, [ensureAudioGraph]);

  unlockAudioRef.current = unlockAudio;

  const setMusicIntensity = useCallback(
    (intensity: number) => {
      musicIntensityRef.current = clamp(intensity, 0.72, 1.25);
      skyRunIntensityProgressRef.current =
        trackRef.current === "sky-run" ? clamp((musicIntensityRef.current - 0.86) / 0.32, 0, 1) : 0;
      scheduleMusicGain(0.32);
    },
    [scheduleMusicGain],
  );

  const playSfx = useCallback(
    (name: ArcadeSfx, options: ArcadeSfxOptions = {}) => {
      const currentSettings = settingsRef.current;
      if (
        !currentSettings.sfxEnabled ||
        currentSettings.silentMode ||
        currentSettings.sfxVolume <= 0
      ) {
        return;
      }

      const context = audioContextRef.current;
      const destination = sfxGainRef.current;
      if (!context || !destination) return;
      if (context.state === "suspended") void context.resume().catch(() => undefined);

      const preset = ARCADE_SFX[name];
      const nowMs = performance.now();
      const lastPlayed = lastSfxAtRef.current.get(name) ?? -Infinity;
      if (nowMs - lastPlayed < preset.cooldownMs) return;
      lastSfxAtRef.current.set(name, nowMs);

      const pitch = clamp(options.pitch ?? 1, 0.82, 1.22);
      if (name === "coin") {
        coinPitchStepRef.current = (coinPitchStepRef.current + 1) % 5;
      }
      const coinVariation = name === "coin" ? 1 + (coinPitchStepRef.current - 2) * 0.018 : 1;
      const pitchRatio = pitch * coinVariation;
      const priorityGain =
        preset.priority === "important" ? 1 : preset.priority === "pickup" ? 0.78 : 0.62;
      const eventGain = clamp(options.volume ?? 1, 0, 1.4);
      const volume = currentSettings.sfxVolume * priorityGain * eventGain;

      if (preset.duckMusic) {
        musicDuckRef.current = 0.72;
        scheduleMusicGain(0.1);
        if (duckTimeoutRef.current !== null) window.clearTimeout(duckTimeoutRef.current);
        duckTimeoutRef.current = window.setTimeout(() => {
          musicDuckRef.current = 1;
          scheduleMusicGain(0.26);
          duckTimeoutRef.current = null;
        }, 520);
      }

      for (const tone of preset.tones) {
        if (activeVoicesRef.current.size >= MAX_ACTIVE_VOICES) {
          if (preset.priority === "ui" || name === "coin") continue;
          const oldestVoice = activeVoicesRef.current.values().next().value;
          if (oldestVoice) {
            try {
              oldestVoice.stop(context.currentTime + 0.004);
            } catch {
              activeVoicesRef.current.delete(oldestVoice);
            }
          }
        }

        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        const startAt = context.currentTime + tone.offset;
        const duration = Math.max(0.035, tone.duration);
        const endAt = startAt + duration;
        const peak = Math.max(0.0001, tone.gain * volume);
        oscillator.type = tone.waveform;
        oscillator.frequency.setValueAtTime(tone.frequency * pitchRatio, startAt);
        if (tone.endFrequency !== undefined) {
          oscillator.frequency.exponentialRampToValueAtTime(
            Math.max(1, tone.endFrequency * pitchRatio),
            endAt,
          );
        }

        envelope.gain.setValueAtTime(0.0001, startAt);
        envelope.gain.exponentialRampToValueAtTime(peak, startAt + Math.min(0.009, duration * 0.2));
        envelope.gain.setValueAtTime(peak * 0.68, startAt + duration * 0.58);
        envelope.gain.exponentialRampToValueAtTime(0.0001, endAt);
        oscillator.connect(envelope).connect(destination);
        oscillator.start(startAt);
        oscillator.stop(endAt + 0.015);
        activeVoicesRef.current.add(oscillator);
        oscillator.addEventListener(
          "ended",
          () => {
            activeVoicesRef.current.delete(oscillator);
            oscillator.disconnect();
            envelope.disconnect();
          },
          { once: true },
        );
      }
    },
    [scheduleMusicGain],
  );

  playSfxRef.current = playSfx;

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Audio preferences remain usable for this session when storage is unavailable.
    }
    syncMusic();
  }, [settings, syncMusic]);

  useEffect(() => {
    syncMusic();
  }, [track, syncMusic]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const musicElement = musicElementRef.current;
      if (!musicElement) return;

      if (trackRef.current !== "sky-run") {
        skyRunIntensityProgressRef.current = 0;
        skyRunPlaybackRateRef.current = 1;
        if (musicElement.playbackRate !== 1) musicElement.playbackRate = 1;
        return;
      }

      const duration = musicElement.duration;
      const songProgress =
        Number.isFinite(duration) && duration > 0
          ? clamp(musicElement.currentTime / duration, 0, 1)
          : 0;
      const runProgress = skyRunIntensityProgressRef.current;
      const targetRate = 1 + Math.max(songProgress * 0.12, runProgress * 0.1);
      skyRunPlaybackRateRef.current = Math.max(skyRunPlaybackRateRef.current, targetRate);

      if (Math.abs(musicElement.playbackRate - skyRunPlaybackRateRef.current) > 0.001) {
        musicElement.playbackRate = skyRunPlaybackRateRef.current;
      }
    }, 500);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const activeVoices = activeVoicesRef.current;
    const onPointerDown = (event: PointerEvent) => {
      unlockAudioRef.current();
      const target = getUiTarget(event.target);
      if (!target) return;
      playSfxRef.current(uiSfxForTarget(target, "ui-click"));
    };

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const target = getUiTarget(event.target);
      if (!target) return;
      if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
      const requested = target.dataset["audioHoverSfx"];
      playSfxRef.current(requested && isSfxName(requested) ? requested : "ui-hover");
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.code === "Escape") {
        unlockAudioRef.current();
        playSfxRef.current("ui-back");
        return;
      }
      if (event.code !== "Enter" && event.code !== "Space") return;
      const target = getUiTarget(event.target);
      if (!target) return;
      unlockAudioRef.current();
      playSfxRef.current(uiSfxForTarget(target, "ui-confirm"));
    };

    const onVisibilityChange = () => {
      const context = audioContextRef.current;
      const musicElement = musicElementRef.current;
      if (document.visibilityState === "hidden") {
        musicElement?.pause();
        if (context?.state === "running") void context.suspend().catch(() => undefined);
      } else {
        if (context?.state === "suspended") void context.resume().catch(() => undefined);
        syncMusicRef.current();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (switchTimeoutRef.current !== null) window.clearTimeout(switchTimeoutRef.current);
      if (duckTimeoutRef.current !== null) window.clearTimeout(duckTimeoutRef.current);
      const musicElement = musicElementRef.current;
      musicElement?.pause();
      if (musicElement) {
        musicElement.removeAttribute("src");
        musicElement.load();
      }
      const context = audioContextRef.current;
      if (context && context.state !== "closed") void context.close().catch(() => undefined);
      activeVoices.clear();
      musicElementRef.current = null;
      musicSourceRef.current = null;
      musicGainRef.current = null;
      sfxGainRef.current = null;
      audioContextRef.current = null;
      audioUnlockedRef.current = false;
    };
  }, []);

  const value = useMemo<AudioContextValue>(
    () => ({ settings, updateSettings, playSfx, setMusicIntensity }),
    [settings, updateSettings, playSfx, setMusicIntensity],
  );

  return <ArcadeAudioContext.Provider value={value}>{children}</ArcadeAudioContext.Provider>;
}

// The context hook intentionally lives beside its provider and exports no UI component.
// eslint-disable-next-line react-refresh/only-export-components
export function useArcadeAudio() {
  const context = useContext(ArcadeAudioContext);
  if (!context) {
    throw new Error("useArcadeAudio deve ser usado dentro de ArcadeAudioProvider.");
  }
  return context;
}
