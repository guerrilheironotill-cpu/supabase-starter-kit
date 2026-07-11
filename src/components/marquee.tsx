const ITEMS = [
  "Entrega para todo o Brasil",
  "Peças artesanais",
  "Design exclusivo",
  "Acabamentos premium",
  "Atendimento personalizado",
  "Garantia de qualidade",
  "Frete calculado no orçamento",
];

export function Marquee() {
  const loop = [...ITEMS, ...ITEMS];
  return (
    <div className="group relative flex overflow-hidden border-y border-primary/10 bg-secondary py-4">
      <div className="flex shrink-0 animate-marquee items-center gap-12 pr-12 group-hover:[animation-play-state:paused]">
        {loop.map((item, i) => (
          <span
            key={i}
            className="flex shrink-0 items-center gap-12 text-sm font-medium uppercase tracking-widest text-primary"
          >
            {item}
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full bg-primary/70"
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
            className="flex shrink-0 items-center gap-12 text-sm font-medium uppercase tracking-widest text-primary"
          >
            {item}
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/70" />
          </span>
        ))}
      </div>
    </div>
  );
}