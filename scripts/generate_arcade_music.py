#!/usr/bin/env python3
"""Generate original, seamless-loop chiptune beds for Spellbound Arcade.

Run from the repository root with Python 3, NumPy and ffmpeg installed:
    python3 scripts/generate_arcade_music.py
"""

from __future__ import annotations

import math
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "audio" / "music"
SAMPLE_RATE = 24_000
BARS = 16

# All compositions are original note sequences. The same pulse/scale vocabulary
# connects them, while tempo, harmony, timbre and rhythm distinguish each game.
TRACKS = {
    "lobby": {
        "bpm": 110,
        "root": 60,  # C4
        "scale": (0, 2, 4, 5, 7, 9, 11),
        "chords": (0, 5, 3, 4),
        "lead": (0, 2, 4, 6, 4, 2, 3, 2),
        "lead_wave": "triangle",
        "arp_wave": "square",
        "bass_wave": "sine",
        "lead_amp": 0.044,
        "arp_amp": 0.024,
        "bass_amp": 0.065,
        "pad_amp": 0.012,
        "drum_amp": 0.55,
        "hats": True,
    },
    "tower": {
        "bpm": 104,
        "root": 50,  # D3
        "scale": (0, 2, 3, 5, 7, 8, 10),
        "chords": (0, 6, 3, 4),
        "lead": (0, 2, 5, 3, 4, 1, 3, 2),
        "lead_wave": "square",
        "arp_wave": "triangle",
        "bass_wave": "sine",
        "lead_amp": 0.041,
        "arp_amp": 0.026,
        "bass_amp": 0.076,
        "pad_amp": 0.010,
        "drum_amp": 0.62,
        "hats": True,
    },
    "sky-flap": {
        "bpm": 128,
        "root": 62,  # D4
        "scale": (0, 2, 4, 5, 7, 9, 11),
        "chords": (0, 5, 2, 4),
        "lead": (4, 2, 0, 2, 5, 4, 2, 1),
        "lead_wave": "square",
        "arp_wave": "triangle",
        "bass_wave": "sine",
        "lead_amp": 0.045,
        "arp_amp": 0.022,
        "bass_amp": 0.058,
        "pad_amp": 0.014,
        "drum_amp": 0.45,
        "hats": True,
    },
    "sky-run": {
        "bpm": 140,
        "root": 52,  # E3
        "scale": (0, 2, 3, 5, 7, 8, 10),
        "chords": (0, 5, 3, 6),
        "lead": (0, 4, 2, 6, 5, 3, 2, 4),
        "lead_wave": "square",
        "arp_wave": "saw",
        "bass_wave": "triangle",
        "lead_amp": 0.040,
        "arp_amp": 0.023,
        "bass_amp": 0.074,
        "pad_amp": 0.009,
        "drum_amp": 0.64,
        "hats": True,
    },
    "maze": {
        "bpm": 96,
        "root": 57,  # A3
        "scale": (0, 2, 3, 5, 7, 8, 10),
        "chords": (0, 5, 3, 4),
        "lead": (0, 2, 3, 1, 4, 2, 5, 2),
        "lead_wave": "triangle",
        "arp_wave": "sine",
        "bass_wave": "sine",
        "lead_amp": 0.028,
        "arp_amp": 0.020,
        "bass_amp": 0.060,
        "pad_amp": 0.016,
        "drum_amp": 0.18,
        "hats": False,
    },
}


def midi_hz(note: int) -> float:
    return 440.0 * (2.0 ** ((note - 69) / 12.0))


def waveform(phase: np.ndarray, kind: str) -> np.ndarray:
    if kind == "square":
        # A lightly softened square avoids brittle aliasing in the upper register.
        return np.tanh(2.8 * np.sin(phase))
    if kind == "triangle":
        return (2.0 / np.pi) * np.arcsin(np.sin(phase))
    if kind == "saw":
        cycle = phase / (2.0 * np.pi)
        return 2.0 * (cycle - np.floor(cycle + 0.5))
    return np.sin(phase)


def add_note(
    audio: np.ndarray,
    start: float,
    duration: float,
    note: int,
    kind: str,
    amplitude: float,
    pan: float = 0.0,
    pluck: float = 0.0,
) -> None:
    start_index = max(0, int(round(start * SAMPLE_RATE)))
    end_index = min(len(audio), int(round((start + duration) * SAMPLE_RATE)))
    length = end_index - start_index
    if length < 2:
        return

    t = np.arange(length, dtype=np.float32) / SAMPLE_RATE
    phase = (2.0 * np.pi * midi_hz(note) * t).astype(np.float32)
    signal = waveform(phase, kind).astype(np.float32)

    attack = max(1, min(length // 3, int(0.008 * SAMPLE_RATE)))
    release = max(1, min(length // 2, int(min(0.065, duration * 0.3) * SAMPLE_RATE)))
    envelope = np.ones(length, dtype=np.float32)
    envelope[:attack] = np.linspace(0.0, 1.0, attack, endpoint=False, dtype=np.float32)
    envelope[-release:] *= np.linspace(1.0, 0.0, release, dtype=np.float32)
    if pluck > 0:
        envelope *= np.exp(-pluck * t / max(duration, 0.01)).astype(np.float32)

    sample = signal * envelope * amplitude
    left = math.sqrt(max(0.0, 1.0 - pan))
    right = math.sqrt(max(0.0, 1.0 + pan))
    audio[start_index:end_index, 0] += sample * left * 0.7071
    audio[start_index:end_index, 1] += sample * right * 0.7071


def add_kick(audio: np.ndarray, start: float, amplitude: float) -> None:
    length = min(int(0.17 * SAMPLE_RATE), len(audio) - int(start * SAMPLE_RATE))
    if length < 2:
        return
    t = np.arange(length, dtype=np.float32) / SAMPLE_RATE
    frequency = 118.0 * np.exp(-t * 21.0) + 42.0
    phase = 2.0 * np.pi * np.cumsum(frequency) / SAMPLE_RATE
    env = np.exp(-t * 24.0)
    sample = (np.sin(phase) * env * amplitude).astype(np.float32)
    index = int(round(start * SAMPLE_RATE))
    audio[index : index + length, 0] += sample * 0.7071
    audio[index : index + length, 1] += sample * 0.7071


def add_hat(audio: np.ndarray, start: float, amplitude: float, seed: int) -> None:
    index = int(round(start * SAMPLE_RATE))
    length = min(int(0.045 * SAMPLE_RATE), len(audio) - index)
    if length < 2:
        return
    rng = np.random.default_rng(seed)
    noise = rng.normal(0.0, 1.0, length).astype(np.float32)
    highpass = np.empty_like(noise)
    highpass[0] = noise[0]
    highpass[1:] = noise[1:] - 0.78 * noise[:-1]
    t = np.arange(length, dtype=np.float32) / SAMPLE_RATE
    sample = highpass * np.exp(-t * 95.0) * amplitude
    audio[index : index + length, 0] += sample * 0.58
    audio[index : index + length, 1] += sample * 0.58


def add_snare(audio: np.ndarray, start: float, amplitude: float, seed: int) -> None:
    index = int(round(start * SAMPLE_RATE))
    length = min(int(0.105 * SAMPLE_RATE), len(audio) - index)
    if length < 2:
        return
    rng = np.random.default_rng(seed)
    noise = rng.normal(0.0, 1.0, length).astype(np.float32)
    t = np.arange(length, dtype=np.float32) / SAMPLE_RATE
    envelope = np.exp(-t * 34.0)
    tone = np.sin(2.0 * np.pi * 185.0 * t) * np.exp(-t * 29.0)
    sample = ((noise * 0.45 + tone * 0.55) * envelope * amplitude).astype(np.float32)
    audio[index : index + length, 0] += sample * 0.65
    audio[index : index + length, 1] += sample * 0.65


def seamless_crossfade(audio: np.ndarray, fade_seconds: float = 0.16) -> np.ndarray:
    fade = min(int(fade_seconds * SAMPLE_RATE), len(audio) // 8)
    if fade < 2:
        return audio
    ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)[:, None]
    seam = audio[-fade:] * (1.0 - ramp) + audio[:fade] * ramp
    # The crossfaded tail ends at the sample immediately before the new start,
    # preserving the loop's length while joining the tail back to the head.
    return np.concatenate((audio[fade:-fade], seam), axis=0)


def compose(name: str, cfg: dict[str, object]) -> np.ndarray:
    bpm = float(cfg["bpm"])
    beat = 60.0 / bpm
    bar_seconds = 4.0 * beat
    frames = int(round(BARS * bar_seconds * SAMPLE_RATE))
    audio = np.zeros((frames, 2), dtype=np.float32)
    root = int(cfg["root"])
    scale = tuple(int(x) for x in cfg["scale"])
    chord_degrees = tuple(int(x) for x in cfg["chords"])
    lead_pattern = tuple(int(x) for x in cfg["lead"])
    lead_wave = str(cfg["lead_wave"])
    arp_wave = str(cfg["arp_wave"])
    bass_wave = str(cfg["bass_wave"])
    lead_amp = float(cfg["lead_amp"])
    arp_amp = float(cfg["arp_amp"])
    bass_amp = float(cfg["bass_amp"])
    pad_amp = float(cfg["pad_amp"])
    drum_amp = float(cfg["drum_amp"])
    hats = bool(cfg["hats"])

    for bar in range(BARS):
        bar_start = bar * bar_seconds
        chord_root = root + scale[chord_degrees[bar % len(chord_degrees)] % len(scale)]
        chord_intervals = (0, scale[2], scale[4], 12)

        # Soft sustained chord bed: barely audible under gameplay, no long reverb tail.
        for voice, interval in enumerate(chord_intervals[:3]):
            add_note(
                audio,
                bar_start,
                bar_seconds * 0.90,
                chord_root + interval,
                "triangle" if name in {"lobby", "maze"} else "sine",
                pad_amp / (1.0 + voice * 0.25),
                pan=(-0.22, 0.0, 0.22)[voice],
                pluck=0.35,
            )

        # Rounded bass anchors the four-beat pulse.
        for beat_index in (0, 2):
            add_note(
                audio,
                bar_start + beat_index * beat,
                beat * 0.82,
                chord_root - 12,
                bass_wave,
                bass_amp,
                pan=-0.04,
                pluck=1.8,
            )

        # Eight gentle digital arpeggio notes per bar, with a slight stereo orbit.
        for step in range(8):
            tone = chord_root + 12 + chord_intervals[(step + bar // 4) % 3]
            if (bar + step) % 7 == 0:
                tone += 12
            add_note(
                audio,
                bar_start + step * beat * 0.5,
                beat * 0.31,
                tone,
                arp_wave,
                arp_amp,
                pan=math.sin((bar * 8 + step) * 0.36) * 0.48,
                pluck=2.4,
            )

        # Original melodic motif: subtle bar-to-bar variation, same style vocabulary.
        for step, degree in enumerate(lead_pattern):
            if name == "maze" and step in (3, 7) and bar % 2:
                continue
            offset = (degree + (bar // 4) * (1 if name != "tower" else 2)) % len(scale)
            melody_note = chord_root + 12 + scale[offset]
            if name in {"sky-flap", "lobby"} and (bar + step) % 6 == 0:
                melody_note += 12
            beat_position = (step * 0.5 + (0.25 if bar % 4 == 2 else 0.0)) % 4.0
            add_note(
                audio,
                bar_start + beat_position * beat,
                beat * (0.30 if name == "sky-run" else 0.38),
                melody_note,
                lead_wave,
                lead_amp * (0.82 if step in (3, 7) else 1.0),
                pan=math.sin((bar + step) * 0.45) * 0.32,
                pluck=2.0,
            )

        # Soft arcade percussion, with the Maze intentionally sparse and calm.
        if name != "maze":
            add_kick(audio, bar_start, drum_amp * 0.060)
            add_kick(audio, bar_start + 2.0 * beat, drum_amp * 0.046)
            add_snare(audio, bar_start + beat, drum_amp * 0.032, seed=bar * 13 + 3)
            add_snare(audio, bar_start + 3.0 * beat, drum_amp * 0.028, seed=bar * 17 + 9)
            if hats:
                for hat_step in range(8):
                    if name == "lobby" and hat_step % 2 == 1:
                        continue
                    add_hat(
                        audio,
                        bar_start + hat_step * beat * 0.5,
                        drum_amp * (0.009 if hat_step % 2 else 0.013),
                        seed=bar * 31 + hat_step + 101,
                    )
        elif bar % 2 == 0:
            add_hat(audio, bar_start + 3.0 * beat, 0.003, seed=bar + 810)

    audio = seamless_crossfade(audio)
    # Soft saturation and controlled loudness keep the soundtrack below one-shots.
    audio = np.tanh(audio * 1.65).astype(np.float32)
    rms = float(np.sqrt(np.mean(audio * audio)))
    peak = float(np.max(np.abs(audio)))
    target_rms = 0.095
    gain = min(1.0, target_rms / max(rms, 1e-6), 0.72 / max(peak, 1e-6))
    return (audio * gain).astype(np.float32)


def write_wav(path: Path, audio: np.ndarray) -> None:
    pcm = np.clip(audio, -1.0, 1.0)
    int16 = (pcm * 32767.0).astype(np.int16)
    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(2)
        wav_file.setsampwidth(2)
        wav_file.setframerate(SAMPLE_RATE)
        wav_file.writeframes(int16.tobytes())


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, cfg in TRACKS.items():
        audio = compose(name, cfg)
        duration = len(audio) / SAMPLE_RATE
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp:
            wav_path = Path(temp.name)
        try:
            write_wav(wav_path, audio)
            mp3_path = OUTPUT / f"{name}.mp3"
            subprocess.run(
                [
                    "ffmpeg",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-i",
                    str(wav_path),
                    "-codec:a",
                    "libmp3lame",
                    "-b:a",
                    "96k",
                    "-ar",
                    str(SAMPLE_RATE),
                    str(mp3_path),
                ],
                check=True,
            )
            print(f"{name}: {duration:.2f}s -> {mp3_path}")
        finally:
            wav_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
