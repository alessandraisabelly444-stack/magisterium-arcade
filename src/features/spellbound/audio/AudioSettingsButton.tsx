import { useEffect, useRef, useState } from "react";

import { useArcadeAudio } from "./ArcadeAudioProvider";

export function AudioSettingsButton() {
  const { settings, updateSettings } = useArcadeAudio();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const musicMuted = !settings.musicEnabled || settings.musicVolume === 0;
  const sfxMuted = !settings.sfxEnabled || settings.sfxVolume === 0;

  return (
    <div ref={containerRef} className="fixed bottom-3 right-3 z-50 font-game">
      {isOpen ? (
        <section
          role="dialog"
          aria-label="Configurações de áudio"
          className="mb-2 w-[min(19rem,calc(100vw-1.5rem))] border-4 border-arcade-violet bg-arcade-panel/98 p-4 text-arcade-ink shadow-[5px_5px_0_var(--color-arcade-shadow)]"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-arcade text-[0.58rem] text-arcade-violet sm:text-xs">
              ÁUDIO DO ARCADE
            </h2>
            <button
              type="button"
              data-audio-sfx="menu-close"
              aria-label="Fechar configurações de áudio"
              onClick={() => setIsOpen(false)}
              className="border-2 border-arcade-panel-border bg-white px-2 py-1 font-arcade text-[0.55rem] hover:bg-arcade-sky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcade-cyan"
            >
              FECHAR
            </button>
          </div>

          <label className="mb-3 block">
            <span className="flex items-center justify-between gap-3 font-arcade text-[0.52rem] sm:text-[0.6rem]">
              <span>🎵 MÚSICA</span>
              <span aria-live="polite">
                {musicMuted ? "MUTADA" : `${Math.round(settings.musicVolume * 100)}%`}
              </span>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.musicVolume}
              aria-label="Volume da música"
              onChange={(event) =>
                updateSettings({ musicVolume: Number(event.currentTarget.value) })
              }
              className="mt-2 h-2 w-full cursor-pointer accent-arcade-violet"
            />
          </label>

          <label className="mb-3 block">
            <span className="flex items-center justify-between gap-3 font-arcade text-[0.52rem] sm:text-[0.6rem]">
              <span>🔊 EFEITOS SONOROS</span>
              <span aria-live="polite">
                {sfxMuted ? "MUTOS" : `${Math.round(settings.sfxVolume * 100)}%`}
              </span>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.sfxVolume}
              aria-label="Volume dos efeitos sonoros"
              onChange={(event) => updateSettings({ sfxVolume: Number(event.currentTarget.value) })}
              className="mt-2 h-2 w-full cursor-pointer accent-arcade-cyan"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => updateSettings({ musicEnabled: !settings.musicEnabled })}
              className="border-2 border-arcade-panel-border bg-white px-2 py-2 font-arcade text-[0.48rem] hover:bg-arcade-sky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcade-cyan sm:text-[0.55rem]"
            >
              {settings.musicEnabled ? "MUTAR MÚSICA" : "ATIVAR MÚSICA"}
            </button>
            <button
              type="button"
              onClick={() => updateSettings({ sfxEnabled: !settings.sfxEnabled })}
              className="border-2 border-arcade-panel-border bg-white px-2 py-2 font-arcade text-[0.48rem] hover:bg-arcade-sky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcade-cyan sm:text-[0.55rem]"
            >
              {settings.sfxEnabled ? "MUTAR EFEITOS" : "ATIVAR EFEITOS"}
            </button>
          </div>

          <button
            type="button"
            aria-pressed={settings.silentMode}
            onClick={() => updateSettings({ silentMode: !settings.silentMode })}
            className={`mt-2 w-full border-2 px-2 py-2 font-arcade text-[0.5rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcade-cyan sm:text-[0.58rem] ${
              settings.silentMode
                ? "border-arcade-pink bg-arcade-pink/20 text-arcade-ink"
                : "border-arcade-panel-border bg-white hover:bg-arcade-sky"
            }`}
          >
            {settings.silentMode ? "🔇 MODO SILENCIOSO ATIVO" : "🔇 MODO SILENCIOSO"}
          </button>
        </section>
      ) : null}

      <button
        type="button"
        data-audio-sfx={isOpen ? "menu-close" : "menu-open"}
        aria-label={isOpen ? "Fechar controles de áudio" : "Abrir controles de áudio"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="ml-auto flex min-h-11 items-center gap-2 border-2 border-arcade-violet bg-arcade-panel/95 px-3 py-2 font-arcade text-[0.5rem] text-arcade-ink shadow-[3px_3px_0_var(--color-arcade-shadow)] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-arcade-cyan"
      >
        <span aria-hidden="true">
          {settings.silentMode ? "🔇" : musicMuted && sfxMuted ? "🔕" : "🔊"}
        </span>
        <span>ÁUDIO</span>
      </button>
    </div>
  );
}
