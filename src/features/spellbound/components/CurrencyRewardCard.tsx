import type { CurrencyRewardReceipt } from "../currency";

export function CurrencyRewardCard({
  receipts,
  className = "",
}: {
  receipts: CurrencyRewardReceipt[];
  className?: string;
}) {
  if (receipts.length === 0) return null;

  return (
    <section
      className={`relative mt-4 overflow-hidden rounded-sm border-2 border-arcade-gold bg-arcade-sky/90 p-3 text-left shadow-[5px_5px_0_var(--color-arcade-shadow)] sm:p-4 ${className}`}
      aria-label="Recompensa de moedas da partida"
      aria-live="polite"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 flex justify-around"
        aria-hidden="true"
      >
        {Array.from({ length: 5 }, (_, index) => (
          <span
            key={index}
            className="coin-reward-particle font-game text-sm text-arcade-gold"
            style={{ animationDelay: `${index * 90}ms` }}
          >
            🪙
          </span>
        ))}
      </div>
      <h3 className="font-arcade text-[0.56rem] text-arcade-violet sm:text-[0.68rem]">
        RECOMPENSA DE MOEDAS
      </h3>
      <div className="mt-2 grid gap-2">
        {receipts.map((receipt) => {
          const formattedTotal = receipt.total.toLocaleString("pt-BR");
          const totalDigitCount = formattedTotal.replace(/\D/g, "").length;
          const useWideBalance = totalDigitCount >= 7;
          const balanceTextSize =
            totalDigitCount >= 13
              ? "text-[0.625rem] sm:text-xs"
              : useWideBalance
                ? "text-sm sm:text-base"
                : "text-base sm:text-lg";

          return (
            <article
              key={receipt.walletId}
              className="grid min-w-0 gap-2 border-t border-arcade-panel-border/60 pt-2 first:border-0 first:pt-0"
            >
              {receipts.length > 1 && (
                <p className="truncate font-game text-sm font-bold text-arcade-ink">
                  {receipt.playerName}
                </p>
              )}
              <div
                className={`grid min-w-0 gap-2 ${useWideBalance ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-[0.9fr_1.1fr]"}`}
              >
                <div className="flex min-w-0 items-center justify-center gap-3 border-2 border-arcade-gold/70 bg-arcade-panel/75 px-3 py-2">
                  <span
                    className="coin-reward-icon shrink-0 text-3xl leading-none sm:text-4xl"
                    aria-hidden="true"
                  >
                    🪙
                  </span>
                  <div className="min-w-0 text-center">
                    <p className="font-arcade text-[0.48rem] text-arcade-violet sm:text-[0.56rem]">
                      MOEDAS GANHAS
                    </p>
                    <p className="coin-reward-amount mt-1 font-arcade text-2xl leading-none text-arcade-gold sm:text-3xl">
                      +{receipt.amount.toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className="flex min-w-0 flex-col items-center justify-center border-2 border-arcade-panel-border bg-arcade-sky/70 px-2 py-2">
                  <p className="font-arcade text-[0.48rem] text-arcade-violet sm:text-[0.56rem]">
                    SALDO TOTAL
                  </p>
                  <div className="mt-1 w-full min-w-0 overflow-x-auto">
                    <p
                      className={`flex w-max min-w-full items-center justify-center gap-1 whitespace-nowrap font-arcade leading-none text-arcade-ink ${balanceTextSize}`}
                      aria-label={`Saldo total: ${formattedTotal} moedas`}
                    >
                      <span className="shrink-0" aria-hidden="true">
                        🪙
                      </span>
                      <span className="shrink-0">{formattedTotal}</span>
                    </p>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
