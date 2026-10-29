interface PixelSceneDecorProps {
  density?: "calm" | "full";
}

const starPositions = [
  "left-[8%] top-[10%]",
  "left-[20%] top-[24%]",
  "left-[44%] top-[12%]",
  "left-[68%] top-[20%]",
  "left-[84%] top-[9%]",
  "left-[91%] top-[36%]",
  "left-[13%] top-[64%]",
  "left-[73%] top-[72%]",
];

function PixelStar({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`twinkle absolute h-3 w-3 bg-arcade-star shadow-[0_0_16px_var(--color-arcade-star)] ${className}`}
    />
  );
}

function PixelCloud({ className }: { className: string }) {
  return (
    <div aria-hidden="true" className={`absolute ${className}`}>
      <div className="relative h-12 w-28 bg-arcade-cloud shadow-[8px_8px_0_var(--color-arcade-cloud-shadow)] sm:h-16 sm:w-40">
        <span className="absolute -top-5 left-5 h-9 w-12 bg-arcade-cloud sm:-top-7 sm:h-12 sm:w-16" />
        <span className="absolute -top-8 left-14 h-12 w-14 bg-arcade-cloud sm:-top-10 sm:left-20 sm:h-16 sm:w-20" />
        <span className="absolute -right-4 top-4 h-8 w-8 bg-arcade-cloud sm:h-10 sm:w-10" />
      </div>
    </div>
  );
}

function FloatingIsland({ className }: { className: string }) {
  return (
    <div aria-hidden="true" className={`floaty absolute ${className}`}>
      <div className="mx-auto h-6 w-24 bg-island-grass-bright shadow-[0_6px_0_var(--color-island-grass)]" />
      <div className="mx-auto h-12 w-16 bg-island-earth shadow-[8px_8px_0_var(--color-arcade-shadow)]" />
    </div>
  );
}

export function PixelSceneDecor({ density = "full" }: PixelSceneDecorProps) {
  const visibleStars = density === "full" ? starPositions : starPositions.slice(0, 5);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden pixelated"
    >
      {visibleStars.map((position) => (
        <PixelStar key={position} className={position} />
      ))}
      <PixelCloud className="left-[-2rem] top-[18%] opacity-85" />
      <PixelCloud className="right-[-3rem] top-[52%] scale-75 opacity-80" />
      {density === "full" ? (
        <>
          <FloatingIsland className="left-[4%] top-[44%] hidden sm:block" />
          <FloatingIsland className="right-[6%] top-[28%] scale-75" />
        </>
      ) : null}
    </div>
  );
}
