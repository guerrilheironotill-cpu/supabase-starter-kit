import { Link } from "@tanstack/react-router";

export function ConcreteCharacteristicsCallout() {
  return (
    <section className="border-t border-primary/10 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-8">
        <h2 className="font-display text-3xl font-medium text-primary sm:text-4xl">
          Características do Concreto
        </h2>
        <p className="mx-auto mt-5 max-w-3xl text-base leading-relaxed text-primary/75">
          Nossos produtos são feitos à mão individualmente, utilizando uma mistura própria de
          concreto. Cada peça apresenta pequenas variações de tonalidade, textura e superfície que
          celebram a beleza natural do material e tornam cada unidade única.
        </p>
        <Link
          to="/caracteristicas-do-concreto"
          className="mt-8 inline-flex bg-[#2f302e] px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary"
        >
          Leia mais
        </Link>
      </div>
    </section>
  );
}
