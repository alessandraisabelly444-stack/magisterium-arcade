import type { ReactNode } from "react";

interface ArcadeCabinetFrameProps {
  children: ReactNode;
}

export function ArcadeCabinetFrame({ children }: ArcadeCabinetFrameProps) {
  return (
    <div className="pixel-panel relative w-full max-w-3xl rounded-sm p-4 sm:p-6">
      <div className="checker-floor absolute inset-x-4 top-4 h-8 opacity-30" aria-hidden="true" />
      <div className="relative border-2 border-arcade-cyan bg-arcade-sky/30 p-4 shadow-[inset_0_0_24px_color-mix(in_oklab,var(--color-arcade-cyan)_24%,transparent)] sm:p-8">
        {children}
      </div>
    </div>
  );
}
