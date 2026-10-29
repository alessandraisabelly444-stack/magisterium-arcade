import type { TowerSnapshot } from "./engine";

interface WinCountdownProps {
  snapshot: TowerSnapshot | null;
}

export function WinCountdown({ snapshot }: WinCountdownProps) {
  if (!snapshot?.winConfirming) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="pixel-panel border-2 border-arcade-cyan bg-arcade-panel px-4 py-2 font-arcade text-2xl leading-none text-arcade-violet shadow-[0_0_12px_#b58cff]">
        {Math.max(1, Math.ceil(snapshot.winSecondsRemaining))}
      </span>
      <span className="mt-2 border border-arcade-panel-border bg-arcade-panel px-2 py-1 font-arcade text-[0.48rem] text-arcade-violet">
        CONFIRMANDO...
      </span>
    </div>
  );
}
