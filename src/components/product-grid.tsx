type Product = {
  name: string;
  image: string;
};

type ProductGridProps = {
  title: string;
  products: Product[];
};

export function ProductGrid({ title, products }: ProductGridProps) {
  return (
    <section className="bg-[#eaf3dd] py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <h2 className="text-center font-display text-3xl text-primary sm:text-4xl">
          {title}
        </h2>
        <div className="mt-10 grid grid-cols-2 gap-5 sm:mt-12 sm:gap-6 lg:grid-cols-4">
          {products.map((p) => (
            <a
              key={p.name}
              href="/"
              className="group block"
            >
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-primary/10 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg">
                <img
                  src={p.image}
                  alt={p.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-primary/70 via-primary/20 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:p-6">
                  <span className="pointer-events-auto translate-y-2 rounded-full bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-primary shadow-lg transition-transform duration-300 group-hover:translate-y-0 sm:text-sm">
                    Ver produto
                  </span>
                </div>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-primary sm:text-xl">
                {p.name}
              </h3>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export const FEATURED_VASES: Product[] = [
  {
    name: "Vaso Malabo com prato",
    image:
      "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Vaso Madrid",
    image:
      "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Vaso Roma",
    image:
      "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Vaso Campala",
    image:
      "https://images.unsplash.com/photo-1602923668104-8f9e03e77e62?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Vaso Dublin",
    image:
      "https://images.unsplash.com/photo-1620127252536-03bdfcf6d5b7?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Vaso Dacar",
    image:
      "https://images.unsplash.com/photo-1531973576160-7125cd663d86?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Vaso Bali",
    image:
      "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Vaso Tóquio",
    image:
      "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=800&q=80",
  },
];

export const PLANTERS: Product[] = [
  {
    name: "Jardineira Lisboa",
    image:
      "https://images.unsplash.com/photo-1523712999610-f77fbcfc3843?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Jardineira Florença",
    image:
      "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Vaso Florença II",
    image:
      "https://images.unsplash.com/photo-1602923668104-8f9e03e77e62?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Jardineira Paris",
    image:
      "https://images.unsplash.com/photo-1531973576160-7125cd663d86?auto=format&fit=crop&w=800&q=80",
  },
];