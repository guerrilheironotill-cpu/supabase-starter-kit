import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { WhatsAppQuoteDrawer } from "./whatsapp-quote-drawer";

export function AboutSection() {
  const [waOpen, setWaOpen] = useState(false);
  return (
    <section className="relative overflow-hidden bg-[#eaf3dd]">
      {/* Decorative palm shadow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-10 hidden h-[520px] w-[520px] opacity-[0.18] lg:block"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 30%, rgba(20,60,40,0.45), transparent 60%)",
        }}
      />

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 py-20 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:py-28">
        <div className="relative">
          <div className="aspect-square overflow-hidden rounded-2xl bg-primary/5 shadow-xl ring-1 ring-primary/10">
            <img
              src="https://arteno.com.br/wp-content/uploads/2024/09/arteno-vasodecor-p-vaso-cimento-florianopolis-vaso-concreto.jpg"
              alt="Coleção de vasos artesanais em concreto"
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        <div>
          <h2 className="font-display text-3xl leading-[1.15] text-primary sm:text-4xl">
            Utilizamos o concreto como matéria-prima para criar peças artesanais únicas.
          </h2>
          <p className="mt-6 max-w-xl text-base text-primary/75 sm:text-lg">
            Somos especialistas em traduzir a solidez do cimento em vasos e projetos sob medida.
          </p>
          <p className="mt-4 max-w-xl text-base text-primary/75 sm:text-lg">
            Cada peça carrega a exclusividade do trabalho feito à mão e a sofisticação do design autoral. Explore nossas criações.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="/catalogo"
              className="inline-flex items-center gap-2 rounded-full bg-secondary px-7 py-3.5 text-sm font-semibold text-primary transition-all duration-300 hover:-translate-y-0.5 hover:bg-secondary/85"
            >
              Explorar Modelos
              <ArrowRight className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={() => setWaOpen(true)}
              className="inline-flex items-center gap-3 rounded-full border border-primary/25 bg-transparent px-7 py-3.5 text-sm font-semibold text-primary transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:bg-primary hover:text-white"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary/40">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
                  <path d="M20.52 3.48A11.87 11.87 0 0 0 12.01 0C5.4 0 .04 5.36.04 11.97c0 2.11.55 4.17 1.6 5.99L0 24l6.2-1.62a11.98 11.98 0 0 0 5.81 1.48h.01c6.61 0 11.97-5.36 11.97-11.97a11.9 11.9 0 0 0-3.47-8.41ZM12.02 21.8h-.01a9.83 9.83 0 0 1-5.01-1.37l-.36-.21-3.68.97.98-3.59-.23-.37a9.85 9.85 0 1 1 18.28-5.26c0 5.43-4.42 9.83-9.97 9.83Zm5.4-7.36c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.66.15-.2.3-.76.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.64-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.66-1.6-.9-2.19-.24-.58-.48-.5-.66-.51h-.56c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.47 0 1.45 1.06 2.86 1.21 3.06.15.2 2.08 3.17 5.03 4.44.7.3 1.25.48 1.68.62.71.22 1.35.19 1.86.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.08-.13-.27-.2-.57-.35Z" />
                </svg>
              </span>
              Fale no WhatsApp
            </button>
          </div>
        </div>
      </div>
      <WhatsAppQuoteDrawer open={waOpen} onClose={() => setWaOpen(false)} />
    </section>
  );
}