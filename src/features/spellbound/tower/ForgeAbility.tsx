import { Button } from "@/components/ui/button";

import { TETROMINO_SHAPES, TETROMINO_TYPES, type TetrominoType } from "./pieces";

interface ForgePickerProps {
  onPick: (type: TetrominoType) => void;
  onCancel: () => void;
}

export function ForgePicker({ onPick, onCancel }: ForgePickerProps) {
  return (
    <div
      className="forge-picker absolute right-2 top-20 z-30 w-[210px] border-2 border-arcade-violet bg-arcade-panel/95 p-2 shadow-lg"
      role="dialog"
      aria-label="Escolher peça para forjar"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-arcade text-[0.43rem] text-arcade-ink">ESCOLHA UMA PEÇA</p>
        <Button
          type="button"
          variant="arcadePanel"
          onClick={onCancel}
          className="h-6 rounded-sm px-1 text-[0.35rem]"
          aria-label="Cancelar forja"
        >
          ESC ✕
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {TETROMINO_TYPES.map((type) => (
          <Button
            key={type}
            type="button"
            variant="arcadePanel"
            onClick={() => onPick(type)}
            className="forge-piece-option h-12 rounded-sm p-1"
            aria-label={`Forjar peça ${type}`}
          >
            <span className="relative block h-8 w-10" aria-hidden="true">
              {TETROMINO_SHAPES[type].map(([x, y], index) => (
                <span
                  key={`${x}-${y}-${index}`}
                  className="absolute h-2.5 w-2.5 border border-arcade-panel-border bg-arcade-lilac shadow-[inset_2px_2px_0_var(--arcade-cloud)]"
                  style={{ left: `${x * 9 + 2}px`, top: `${y * 9 + 3}px` }}
                />
              ))}
            </span>
            <span className="font-arcade text-[0.38rem] text-arcade-ink">{type}</span>
          </Button>
        ))}
      </div>
      <p className="mt-1.5 text-center font-arcade text-[0.32rem] text-arcade-violet">
        Z PARA CANCELAR
      </p>
    </div>
  );
}

interface ForgeSequenceProps {
  type: TetrominoType;
}

export function ForgeSequence({ type }: ForgeSequenceProps) {
  return (
    <div
      className="forge-sequence pointer-events-none absolute bottom-[7%] left-[8%] z-20 h-24 w-28"
      aria-live="polite"
    >
      <div className="forge-smoke absolute left-10 top-0 h-3 w-3 bg-arcade-cloud/60" />
      <div
        className="forge-hammer absolute left-1 top-1 h-14 w-5 origin-bottom-right"
        aria-hidden="true"
      >
        <span className="absolute left-2 top-4 h-10 w-2 bg-arcade-violet" />
        <span className="absolute left-0 top-1 h-5 w-5 border-2 border-arcade-panel-border bg-arcade-cloud" />
      </div>
      <div className="forge-anvil absolute bottom-1 left-8 h-11 w-16 border-2 border-arcade-panel-border bg-arcade-violet">
        <span className="absolute -left-2 -right-2 -top-2 h-3 border-2 border-arcade-panel-border bg-arcade-cloud" />
        <span className="forge-fire absolute -top-7 left-2 h-7 w-10" />
        <span className="forge-piece-silhouette absolute left-1/2 top-0 h-8 w-10 -translate-x-1/2">
          {TETROMINO_SHAPES[type].map(([x, y], index) => (
            <span
              key={`${x}-${y}-${index}`}
              className="absolute h-2.5 w-2.5 border border-forge-shadow bg-forge-hot shadow-[inset_2px_2px_0_var(--forge-white)]"
              style={{ left: `${x * 8 + 2}px`, top: `${y * 8 + 2}px` }}
            />
          ))}
        </span>
      </div>
      {Array.from({ length: 10 }).map((_, index) => (
        <span
          key={index}
          className="forge-spark absolute bottom-10 left-14 h-1.5 w-1.5 bg-forge-hot"
          style={
            {
              "--spark-x": `${((index % 5) - 2) * 11}px`,
              "--spark-y": `${-18 - (index % 3) * 9}px`,
              animationDelay: `${index * 25}ms`,
            } as React.CSSProperties
          }
        />
      ))}
      <p className="absolute -bottom-4 left-0 w-full text-center font-arcade text-[0.38rem] text-forge-hot">
        FORJANDO {type}!
      </p>
    </div>
  );
}
