import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

const DEFAULT_BG =
  "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1920&q=80";

export type Crumb = { label: string; to?: string };

type Props = {
  title: string;
  eyebrow?: string;
  count?: number;
  crumbs?: Crumb[];
  image?: string;
};

export function PageHero({ title, eyebrow, count, crumbs = [], image }: Props) {
  const bg = image || DEFAULT_BG;
  return (
    <section className="relative w-full px-4 sm:px-8 lg:px-[50px]">
      <div className="relative h-[38vh] min-h-[280px] w-full overflow-hidden rounded-3xl bg-primary">
        <img
          src={bg}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-primary/30 to-primary/20" />

        <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center text-white sm:px-8">
          {crumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="mb-4 text-xs text-white/80">
              <ol className="flex flex-wrap items-center justify-center gap-1">
                {crumbs.map((c, i) => (
                  <li key={i} className="inline-flex items-center gap-1">
                    {c.to ? (
                      <Link to={c.to} className="hover:text-white">
                        {c.label}
                      </Link>
                    ) : (
                      <span className="text-white">{c.label}</span>
                    )}
                    {i < crumbs.length - 1 && (
                      <ChevronRight className="h-3 w-3 opacity-60" />
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          )}
          {eyebrow && (
            <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.35em] text-white/80">
              {eyebrow}
            </span>
          )}
          <h1 className="mt-3 font-display text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          {typeof count === "number" && (
            <p className="mt-3 text-sm text-white/85">
              {count} {count === 1 ? "produto" : "produtos"}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}