interface PlayerBadgeProps {
  playerName: string;
}

export function PlayerBadge({ playerName }: PlayerBadgeProps) {
  return (
    <section className="pixel-panel rounded-sm p-3 sm:p-4" aria-label="Jogador atual">
      <div className="min-w-0">
        <p className="font-arcade text-[0.56rem] text-arcade-violet sm:text-[0.65rem]">JOGADOR</p>
        <p className="truncate font-arcade text-sm uppercase text-arcade-panel-foreground sm:text-base">
          {playerName}
        </p>
      </div>
    </section>
  );
}
