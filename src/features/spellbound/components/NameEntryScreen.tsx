import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import type { PlayerEntryResult } from "../hooks/usePlayerSession";
import { MAX_PLAYER_NAME_LENGTH } from "../playerProfile";
import { ArcadeCabinetFrame } from "./ArcadeCabinetFrame";
import { PixelSceneDecor } from "./PixelSceneDecor";

interface NameEntryScreenProps {
  onEnter: (playerName: string) => Promise<PlayerEntryResult>;
}

export function NameEntryScreen({ onEnter }: NameEntryScreenProps) {
  const [playerName, setPlayerName] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setIsError(false);
    try {
      const result = await onEnter(playerName);
      setMessage(result.message);
      setIsError(!result.ok);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="celestial-sky relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 text-foreground">
      <PixelSceneDecor density="calm" />
      <ArcadeCabinetFrame>
        <form
          onSubmit={handleSubmit}
          className="relative z-10 flex w-full flex-col items-center gap-5 text-center sm:gap-7"
        >
          <div className="space-y-3">
            <h1 className="pixel-title max-w-2xl text-3xl leading-relaxed text-arcade-ink sm:text-5xl md:text-6xl">
              MAGISTERIUM ARCADE
            </h1>
            <p className="font-arcade text-[0.62rem] text-arcade-violet sm:text-xs">
              QUAL É O SEU NOME?
            </p>
          </div>

          <label className="flex w-full max-w-xl flex-col gap-2 text-left">
            <span className="sr-only">Seu nome</span>
            <input
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
              maxLength={MAX_PLAYER_NAME_LENGTH}
              minLength={1}
              required
              autoComplete="nickname"
              autoFocus
              placeholder="SEU NOME"
              className="h-12 w-full rounded-sm border-2 border-arcade-panel-border bg-arcade-panel px-3 font-arcade text-xs uppercase text-arcade-panel-foreground outline-none transition focus:border-arcade-cyan focus:ring-4 focus:ring-arcade-cyan/40 sm:h-14 sm:text-sm"
            />
          </label>

          <div
            className={`min-h-6 max-w-xl text-center text-xs sm:text-sm ${isError ? "text-destructive" : "text-arcade-violet"}`}
            role={isError ? "alert" : "status"}
            aria-live="polite"
          >
            {message}
          </div>

          <Button
            type="submit"
            variant="arcade"
            size="arcade"
            className="w-full max-w-xs"
            disabled={isSubmitting}
          >
            {isSubmitting ? "ENTRANDO…" : "ENTRAR"}
          </Button>
        </form>
      </ArcadeCabinetFrame>
    </main>
  );
}
