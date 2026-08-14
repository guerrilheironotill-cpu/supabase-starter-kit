import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { useWhatsAppNumber, whatsappLinkFrom } from "@/lib/site-settings";

export function AboutSection() {
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const whatsappUrl = whatsappLinkFrom(
    useWhatsAppNumber(),
    "Olá! Gostaria de falar com a equipe da Arteno.",
  );

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -8%", threshold: 0.12 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const revealStyle = (delay: number, distance = 24): CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translate3d(0, 0, 0)" : `translate3d(0, ${distance}px, 0)`,
    transition: "opacity 1800ms cubic-bezier(0.16, 1, 0.3, 1), transform 1800ms cubic-bezier(0.16, 1, 0.3, 1)",
    transitionDelay: visible ? `${delay}ms` : "0ms",
    willChange: visible ? "auto" : "opacity, transform",
  });

  const fadeStyle = (delay: number): CSSProperties => ({
    opacity: visible ? 1 : 0,
    transition: "opacity 1600ms cubic-bezier(0.16, 1, 0.3, 1)",
    transitionDelay: visible ? `${delay}ms` : "0ms",
    willChange: visible ? "auto" : "opacity",
  });

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-[#eaf3dd]">
      <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 py-20 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:py-28">
        <div
          className="relative"
          style={revealStyle(0, 32)}
        >
          <div className="aspect-square overflow-hidden rounded-2xl bg-primary/5 shadow-xl ring-1 ring-primary/10">
            <img
              width={600}
              height={616}
              src="/images/sobre-arteno-vasos-concreto.webp"
              alt="Coleção de vasos artesanais em concreto"
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        <div>
          <h2
            className="font-display text-3xl leading-[1.15] text-primary sm:text-4xl"
            style={revealStyle(240, 26)}
          >
            Utilizamos o concreto como matéria-prima para criar peças artesanais únicas.
          </h2>
          <p
            className="mt-6 max-w-xl text-base text-primary/75 sm:text-lg"
            style={revealStyle(480, 22)}
          >
            Somos especialistas em traduzir a solidez do cimento em vasos e projetos sob medida.
          </p>
          <p
            className="mt-4 max-w-xl text-base text-primary/75 sm:text-lg"
            style={revealStyle(680, 20)}
          >
            Cada peça carrega a exclusividade do trabalho feito à mão e a sofisticação do design autoral. Explore nossas criações.
          </p>

          <div
            className="mt-10 flex flex-wrap items-center gap-4"
            style={fadeStyle(1050)}
          >
            <a
              href="/catalogo"
              className="inline-flex items-center gap-2 rounded-full bg-secondary px-7 py-3.5 text-sm font-semibold text-primary transition-all duration-300 hover:-translate-y-0.5 hover:bg-secondary/85"
            >
              Explorar Modelos
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-full border border-primary/25 bg-transparent px-7 py-3.5 text-sm font-semibold text-primary transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:bg-primary hover:text-white"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary/40">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
                  <path d="M20.52 3.48A11.87 11.87 0 0 0 12.01 0C5.4 0 .04 5.36.04 11.97c0 2.11.55 4.17 1.6 5.99L0 24l6.2-1.62a11.98 11.98 0 0 0 5.81 1.48h.01c6.61 0 11.97-5.36 11.97-11.97a11.9 11.9 0 0 0-3.47-8.41ZM12.02 21.8h-.01a9.83 9.83 0 0 1-5.01-1.37l-.36-.21-3.68.97.98-3.59-.23-.37a9.85 9.85 0 1 1 18.28-5.26c0 5.43-4.42 9.83-9.97 9.83Zm5.4-7.36c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.66.15-.2.3-.76.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.64-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.66-1.6-.9-2.19-.24-.58-.48-.5-.66-.51h-.56c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.47 0 1.45 1.06 2.86 1.21 3.06.15.2 2.08 3.17 5.03 4.44.7.3 1.25.48 1.68.62.71.22 1.35.19 1.86.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.08-.13-.27-.2-.57-.35Z" />
                </svg>
              </span>
              Fale no WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
