const ITEMS = [
  "Vasos de concreto",
  "Jardineiras",
  "Mesas",
  "Projetos Sob Medida",
  "Fontes",
  "Bancos",
];

type MarqueeProps = {
  tone?: "light" | "dark";
};

export function Marquee({ tone = "light" }: MarqueeProps) {
  const loop = [...ITEMS, ...ITEMS];
  const textClass = tone === "dark" ? "text-primary" : "text-white";
  const dotClass = tone === "dark" ? "bg-primary/60" : "bg-white/70";
  return (
    <div
      className="group relative flex overflow-hidden py-4"
      style={{
        maskImage:
          "linear-gradient(to right, transparent 0, #000 8%, #000 92%, transparent 100%)",
      }}
    >
      <div className="flex shrink-0 animate-marquee items-center gap-14 pr-14 group-hover:[animation-play-state:paused]">
        {loop.map((item, i) => (
          <span
            key={i}
            className={`flex shrink-0 items-center gap-14 font-display text-4xl leading-none sm:text-5xl lg:text-6xl ${textClass}`}
          >
            {item}
            <span
              aria-hidden="true"
              className={`inline-block h-2 w-2 rounded-full ${dotClass}`}
            />
          </span>
        ))}
      </div>
      <div
        aria-hidden="true"
        className="flex shrink-0 animate-marquee items-center gap-14 pr-14 group-hover:[animation-play-state:paused]"
      >
        {loop.map((item, i) => (
          <span
            key={i}
            className={`flex shrink-0 items-center gap-14 font-display text-4xl leading-none sm:text-5xl lg:text-6xl ${textClass}`}
          >
            {item}
            <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
          </span>
        ))}
      </div>
    </div>
  );
}