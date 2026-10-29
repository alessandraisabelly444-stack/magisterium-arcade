export function CelestialIsland() {
  return (
    <section
      className="relative mx-auto min-h-[18rem] w-full max-w-3xl pixelated sm:min-h-[24rem]"
      aria-label="Ilha do lobby celestial"
    >
      <div className="floaty absolute left-1/2 top-16 h-28 w-[18rem] -translate-x-1/2 bg-island-grass-bright shadow-[0_12px_0_var(--color-island-grass),0_24px_0_var(--color-island-earth),0_38px_0_var(--color-arcade-shadow)] sm:top-20 sm:h-36 sm:w-[32rem]" />
      <div className="absolute left-1/2 top-28 h-16 w-44 -translate-x-1/2 bg-island-earth shadow-[12px_12px_0_var(--color-arcade-shadow)] sm:top-36 sm:h-24 sm:w-72" />

      <div className="absolute left-[16%] top-20 h-24 w-16 bg-arcade-panel shadow-[6px_6px_0_var(--color-arcade-shadow)] sm:left-[24%] sm:top-24 sm:h-32 sm:w-20">
        <div className="m-2 h-8 bg-arcade-cyan" />
        <div className="mx-auto mt-3 h-4 w-8 bg-arcade-pink" />
        <div className="mx-auto mt-2 h-3 w-10 bg-arcade-star" />
      </div>

      <div className="absolute right-[14%] top-16 h-28 w-20 bg-arcade-violet shadow-[6px_6px_0_var(--color-arcade-shadow)] sm:right-[24%] sm:top-20 sm:h-36 sm:w-24">
        <div className="mx-auto mt-[-1rem] h-8 w-8 bg-arcade-star" />
        <div className="mx-auto mt-4 h-12 w-10 bg-arcade-cloud" />
        <div className="mx-auto mt-3 h-4 w-14 bg-arcade-cyan" />
      </div>

      <div className="absolute left-[44%] top-4 h-20 w-12 bg-arcade-cyan shadow-[5px_5px_0_var(--color-arcade-shadow)] sm:left-[46%] sm:top-6 sm:h-28 sm:w-16">
        <div className="mx-auto mt-[-0.75rem] h-6 w-6 rotate-45 bg-arcade-star" />
        <div className="mx-auto mt-4 h-10 w-6 bg-arcade-panel" />
      </div>

      <div className="absolute bottom-2 left-[10%] h-8 w-24 bg-arcade-cloud shadow-[7px_7px_0_var(--color-arcade-cloud-shadow)] sm:left-[4%] sm:h-10 sm:w-36" />
      <div className="absolute bottom-14 right-[4%] h-6 w-20 bg-arcade-cloud shadow-[6px_6px_0_var(--color-arcade-cloud-shadow)] sm:right-[10%] sm:h-8 sm:w-32" />
    </section>
  );
}
