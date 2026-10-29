import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { LobbyOption } from "../types";

interface LobbyOptionButtonProps {
  option: LobbyOption;
  onSelect: (option: LobbyOption) => void;
}

export function LobbyOptionButton({ option, onSelect }: LobbyOptionButtonProps) {
  return (
    <Button
      type="button"
      data-audio-sfx="menu-open"
      variant="arcadePanel"
      size="arcade"
      onClick={() => onSelect(option)}
      className="group h-auto min-h-20 w-full max-w-full min-w-0 justify-start whitespace-normal overflow-hidden rounded-sm p-3 text-left sm:min-h-20 sm:p-3"
    >
      <span
        className={cn(
          "h-10 w-10 shrink-0 border-2 border-arcade-panel-border shadow-[4px_4px_0_var(--color-arcade-shadow)]",
          option.accentClassName,
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.62rem] leading-relaxed text-arcade-ink sm:text-xs">
          {option.label}
        </span>
        <span className="mt-1 block break-words font-game text-sm leading-snug text-muted-foreground sm:text-base">
          {option.description}
        </span>
      </span>
    </Button>
  );
}
