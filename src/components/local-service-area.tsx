import { MapPin, PackageCheck, Warehouse } from "lucide-react";
import type { ReactNode } from "react";

const areas = ["Florianópolis", "São José", "Palhoça", "Biguaçu"];

export function LocalServiceArea() {
  return (
    <section className="bg-[#eef0ea] py-14 text-primary sm:py-18" aria-labelledby="local-title">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary/55">
            Produção e atendimento local
          </p>
          <h2 id="local-title" className="mt-3 max-w-2xl font-display text-3xl sm:text-4xl">
            Vasos de concreto na Grande Florianópolis
          </h2>
          <p className="mt-5 max-w-2xl leading-7 text-primary/75">
            Produzimos peças artesanais em Florianópolis e priorizamos entregas na região. A
            proximidade reduz o impacto do frete em produtos pesados e facilita o atendimento de
            residências, arquitetos, paisagistas e empresas.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2" aria-label="Principais cidades atendidas">
            {areas.map((area) => (
              <li
                key={area}
                className="rounded-full border border-primary/15 bg-white px-4 py-2 text-sm"
              >
                {area}
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <ServiceItem icon={<MapPin />} title="Entrega regional">
            Consulte a disponibilidade pelo CEP para Florianópolis e cidades próximas.
          </ServiceItem>
          <ServiceItem icon={<Warehouse />} title="Retirada em Florianópolis">
            Também é possível combinar a retirada na região de Jurerê.
          </ServiceItem>
          <ServiceItem icon={<PackageCheck />} title="Frete avaliado antes da confirmação" wide>
            Para outras localidades, avaliamos a viabilidade logística antes de confirmar o pedido.
          </ServiceItem>
        </div>
      </div>
    </section>
  );
}

function ServiceItem({
  icon,
  title,
  children,
  wide = false,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={`flex gap-4 border border-primary/10 bg-white p-5 ${wide ? "sm:col-span-2 lg:col-span-1" : ""}`}
    >
      <span className="mt-0.5 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-primary/65">{children}</p>
      </div>
    </div>
  );
}
