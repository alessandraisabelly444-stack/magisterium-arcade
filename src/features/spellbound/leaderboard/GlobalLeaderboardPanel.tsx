import { Button } from "@/components/ui/button";

import type { GlobalLeaderboardEntry } from "./api";

interface GlobalLeaderboardPanelProps {
  entries: GlobalLeaderboardEntry[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function GlobalLeaderboardPanel({
  entries,
  isLoading,
  error,
  onRefresh,
}: GlobalLeaderboardPanelProps) {
  return (
    <section
      className="pixel-panel min-w-0 rounded-sm border-2 border-arcade-gold/80 p-3 shadow-[4px_4px_0_var(--color-arcade-shadow)] sm:p-5"
      aria-labelledby="spellbound-ranking-title"
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b-2 border-arcade-panel-border/70 pb-3">
        <div>
          <p className="mb-2 font-arcade text-[0.48rem] text-arcade-cyan sm:text-[0.58rem]">
            RECORDES DOS QUATRO JOGOS · CLASSIFICAÇÃO GLOBAL
          </p>
          <h2
            id="spellbound-ranking-title"
            className="font-arcade text-sm leading-relaxed text-arcade-violet sm:text-lg"
          >
            🏆 RANKING
          </h2>
          <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
            Pontos: Torre × 100 + Sky Flap + Sky Run + Maze
          </p>
        </div>
        <Button
          type="button"
          variant="arcade"
          size="sm"
          className="shrink-0 font-arcade text-[0.48rem]"
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="Atualizar ranking global"
        >
          {isLoading ? "ATUALIZANDO…" : "ATUALIZAR"}
        </Button>
      </header>

      <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto_3.4rem] items-center gap-2 border-b-2 border-arcade-panel-border bg-arcade-sky/45 px-2 py-2 font-arcade text-[0.42rem] text-arcade-ink sm:grid-cols-[3rem_minmax(0,1fr)_7rem_6rem] sm:gap-3 sm:px-3 sm:text-[0.54rem]">
        <span>POS.</span>
        <span>JOGADOR</span>
        <span className="text-right">PONTOS</span>
        <span className="text-right">🪙 MOEDAS</span>
      </div>

      {error ? (
        <div className="my-4 border-2 border-arcade-pink/70 bg-arcade-pink/10 p-3 text-center">
          <p className="font-arcade text-[0.48rem] leading-relaxed text-arcade-ink sm:text-[0.58rem]">
            RANKING TEMPORARIAMENTE INDISPONÍVEL
          </p>
          <p className="mt-2 text-xs text-muted-foreground sm:text-sm">{error}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Seus recordes e moedas locais continuam salvos neste dispositivo.
          </p>
        </div>
      ) : null}

      {isLoading && entries.length === 0 ? (
        <div className="space-y-2 py-3" aria-label="Carregando classificação" aria-live="polite">
          {[0, 1, 2, 3].map((row) => (
            <div
              key={row}
              className="h-10 animate-pulse border border-arcade-panel-border/60 bg-arcade-sky/30"
            />
          ))}
        </div>
      ) : null}

      {!isLoading && !error && entries.length === 0 ? (
        <p className="px-3 py-8 text-center font-game text-sm text-muted-foreground">
          Nenhum recorde global ainda. Jogue para inaugurar o ranking!
        </p>
      ) : null}

      {entries.length > 0 ? (
        <ol
          className="max-h-[26rem] overflow-y-auto"
          aria-label="Classificação global dos jogadores"
        >
          {entries.map((entry) => (
            <li
              key={entry.position}
              className={`grid grid-cols-[2rem_minmax(0,1fr)_auto_3.4rem] items-center gap-2 border-b border-arcade-panel-border/45 px-2 py-2.5 last:border-0 sm:grid-cols-[3rem_minmax(0,1fr)_7rem_6rem] sm:gap-3 sm:px-3 ${entry.isCurrentPlayer ? "bg-arcade-gold/20 ring-2 ring-inset ring-arcade-gold" : "odd:bg-arcade-sky/20"}`}
              aria-current={entry.isCurrentPlayer ? "true" : undefined}
              aria-label={`${entry.position}º lugar, ${entry.name}, ${entry.points.toLocaleString("pt-BR")} pontos, ${entry.coins.toLocaleString("pt-BR")} moedas${entry.isCurrentPlayer ? ", você" : ""}`}
            >
              <span className="font-arcade text-[0.5rem] text-arcade-violet sm:text-xs">
                {entry.position}º
              </span>
              <span
                className={`min-w-0 truncate font-arcade text-[0.48rem] sm:text-[0.62rem] ${entry.isCurrentPlayer ? "text-arcade-ink" : "text-arcade-panel-foreground"}`}
                title={entry.name}
              >
                {entry.name.toLocaleUpperCase("pt-BR")}
                {entry.isCurrentPlayer ? (
                  <span className="ml-2 text-[0.4rem] text-arcade-gold sm:text-[0.48rem]">
                    VOCÊ
                  </span>
                ) : null}
              </span>
              <span className="text-right font-arcade text-[0.48rem] text-arcade-cyan sm:text-xs">
                {entry.points.toLocaleString("pt-BR")}
              </span>
              <span className="text-right font-arcade text-[0.45rem] text-arcade-gold sm:text-[0.58rem]">
                {entry.coins.toLocaleString("pt-BR")}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
