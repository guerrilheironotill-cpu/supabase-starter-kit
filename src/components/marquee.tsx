const ITEMS = [
  "Peças artesanais",
  "Design exclusivo",
  "Produção própria",
  "Atendimento personalizado",
  "Garantia de qualidade",
];

export function Marquee() {
  const loop = [...ITEMS, ...ITEMS];
  return (
    <div
      className="group relative flex overflow-hidden py-4"
      style={{
        maskImage:
          "linear-gradient(to right, transparent 0, #000 8%, #000 92%, transparent 100%)",
      }}
    >
      <div className="flex shrink-0 animate-marquee items-center gap-12 pr-12 group-hover:[animation-play-state:paused]">
        {loop.map((item, i) => (
          <span
            key={i}
            className="flex shrink-0 items-center gap-12 text-xs font-medium uppercase tracking-[0.25em] text-white"
          >
            {item}
            <span
              aria-hidden="true"
              className="inline-block h-1 w-1 rounded-full bg-white/70"
            />
          </span>
        ))}
      </div>
      <div
        aria-hidden="true"
        className="flex shrink-0 animate-marquee items-center gap-12 pr-12 group-hover:[animation-play-state:paused]"
      >
        {loop.map((item, i) => (
          <span
            key={i}
            className="flex shrink-0 items-center gap-12 text-xs font-medium uppercase tracking-[0.25em] text-white"
          >
            {item}
            <span className="inline-block h-1 w-1 rounded-full bg-white/70" />
          </span>
        ))}
      </div>
    </div>
  );
}
