import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ProductSpotlight } from "@/components/blog/product-spotlight";
import { headingId, type BlogBlock } from "@/lib/blog";

const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

/** Renders the inline markup of a text: **bold** and [text](/internal-path). */
export function renderInline(text: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter(Boolean)
    .map((part, index) => {
      const bold = part.match(/^\*\*([^*]+)\*\*$/);
      if (bold) return <strong key={index}>{bold[1]}</strong>;
      const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        const className =
          "font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary";
        return link[2].startsWith("/") ? (
          <Link key={index} to={link[2] as never} className={className}>
            {link[1]}
          </Link>
        ) : (
          <a
            key={index}
            href={link[2]}
            target="_blank"
            rel="noopener noreferrer"
            className={className}
          >
            {link[1]}
          </a>
        );
      }
      return part;
    });
}

export function BlogContent({ blocks }: { blocks: BlogBlock[] }) {
  return (
    <div className="space-y-5 text-base leading-[1.8] text-primary/85">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "h2":
            return (
              <h2
                key={index}
                id={headingId(block.text)}
                className="scroll-mt-28 pt-6 font-display text-2xl leading-tight text-primary sm:text-3xl"
              >
                {block.text}
              </h2>
            );
          case "h3":
            return (
              <h3
                key={index}
                id={headingId(block.text)}
                className="scroll-mt-28 pt-2 font-display text-xl text-primary"
              >
                {block.text}
              </h3>
            );
          case "p":
            return <p key={index}>{renderInline(block.text)}</p>;
          case "ul":
            return (
              <ul key={index} className="space-y-2 pl-1">
                {block.items.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span
                      aria-hidden
                      className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                    />
                    <span>{renderInline(item)}</span>
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={index} className="space-y-3">
                {block.items.map((item, itemIndex) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {itemIndex + 1}
                    </span>
                    <span>{renderInline(item)}</span>
                  </li>
                ))}
              </ol>
            );
          case "callout":
            return (
              <aside key={index} className="border-l-4 border-primary bg-[#f5f6f2] p-5">
                <p className="font-display text-lg text-primary">{block.title}</p>
                <p className="mt-2 text-[0.95rem] leading-relaxed">{renderInline(block.text)}</p>
              </aside>
            );
          case "product":
            return (
              <ProductSpotlight
                key={index}
                search={block.search}
                title={block.title}
                text={block.text}
                fallbackHref={block.fallbackHref}
                fallbackLabel={block.fallbackLabel}
              />
            );
          case "image":
            return (
              <figure key={index} className="py-2">
                <img
                  src={block.src}
                  alt={block.alt}
                  loading="lazy"
                  className="w-full rounded-2xl object-cover"
                />
                {block.caption && (
                  <figcaption className="mt-2 text-center text-xs text-primary/60">
                    {block.caption}
                  </figcaption>
                )}
              </figure>
            );
        }
      })}
    </div>
  );
}
