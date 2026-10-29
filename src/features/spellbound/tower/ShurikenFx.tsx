import type { CSSProperties } from "react";

interface ShurikenFxProps {
  shotKey: number;
  target: { x: number; y: number };
  phase: "flight" | "impact";
}

/** Short player-arena-only projectile and impact effect. */
export function ShurikenFx({ shotKey, target, phase }: ShurikenFxProps) {
  const vars = {
    "--shuriken-x": `${target.x}%`,
    "--shuriken-y": `${target.y}%`,
  } as CSSProperties;

  return (
    <div
      key={`${shotKey}-${phase}`}
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
      style={vars}
      aria-hidden="true"
    >
      {phase === "flight" ? (
        <>
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className={`shuriken-trail absolute ${i % 3 === 0 ? "shuriken-trail-spark" : ""}`}
              style={
                {
                  "--trail-delay": `${(i + 1) * 0.025}s`,
                  "--trail-offset": `${((i % 3) - 1) * 7}px`,
                } as CSSProperties
              }
            />
          ))}
          <svg
            className="shuriken-projectile absolute"
            viewBox="0 0 24 24"
            shapeRendering="crispEdges"
          >
            <path
              d="M10 1h4v7l6-4 2 4-6 4 6 4-2 4-6-4v7h-4v-7l-6 4-2-4-6-4-6-4 2-4 6 4V1Z"
              fill="currentColor"
            />
            <rect x="10" y="10" width="4" height="4" fill="var(--arcade-cloud)" />
          </svg>
        </>
      ) : (
        <div
          className="shuriken-impact absolute"
          style={{ left: `${target.x}%`, top: `${target.y}%` }}
        >
          <span className="shuriken-impact-flash" />
          {Array.from({ length: 16 }).map((_, i) => (
            <span
              key={i}
              className="shuriken-fragment"
              style={
                {
                  "--burst-angle": `${i * 22.5}deg`,
                  "--burst-distance": `${14 + (i % 4) * 7}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
