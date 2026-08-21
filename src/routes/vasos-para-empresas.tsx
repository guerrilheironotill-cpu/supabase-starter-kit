import { createFileRoute } from "@tanstack/react-router";
import { SeoLandingPage } from "@/components/seo-landing-page";
import { absoluteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/vasos-para-empresas")({
  head: () => ({
    meta: [
      { title: "Vasos para Empresas: projetos personalizados — Arteno" },
      {
        name: "description",
        content:
          "Vasos para empresas com design moderno, alta resistência, cores personalizadas e aplicação de logotipo para ambientes corporativos.",
      },
      { property: "og:title", content: "Vasos para Empresas: elegância e personalização — Arteno" },
      {
        property: "og:description",
        content:
          "Soluções personalizadas para recepções, escritórios, restaurantes e áreas externas empresariais.",
      },
      { property: "og:image", content: absoluteUrl("/images/vasos-para-empresas/hero.webp") },
      { property: "og:url", content: absoluteUrl("/vasos-para-empresas") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/vasos-para-empresas") }],
  }),
  component: VasosParaEmpresasPage,
});

function VasosParaEmpresasPage() {
  return (
    <SeoLandingPage
      eyebrow="Projetos corporativos"
      title="Vasos para empresas: elegância e personalização"
      subtitle="Design, resistência e identidade para ambientes de trabalho, hospitalidade e áreas comerciais."
      intro={[
        "Os vasos para empresas são mais do que elementos decorativos: transmitem sofisticação, reforçam a identidade da marca e criam um ambiente acolhedor para colaboradores e clientes.",
        "Nossa linha de vasos corporativos alia design moderno, resistência e opções de personalização para recepções, salas de reunião, escritórios, restaurantes e áreas externas empresariais.",
      ]}
      hero="/images/vasos-para-empresas/hero.webp"
      heroSrcSet="/images/vasos-para-empresas/hero-800.webp 800w, /images/vasos-para-empresas/hero.webp 1600w"
      gallery={[
        {
          src: "/images/vasos-para-empresas/projeto-corporativo-arteno.webp",
          alt: "Vasos personalizados em projeto corporativo",
        },
        {
          src: "/images/vasos-para-empresas/vasos-restaurante.webp",
          alt: "Vasos Arteno em ambiente empresarial",
        },
      ]}
      featuresTitle="Por que escolher nossos vasos para sua empresa"
      features={[
        {
          title: "Projetos personalizados",
          text: "Desenvolvemos vasos nas cores da sua empresa, com possibilidade de aplicação do logotipo.",
        },
        {
          title: "Design exclusivo",
          text: "Modelos modernos que dialogam com diferentes estilos de arquitetura corporativa.",
        },
        {
          title: "Durabilidade",
          text: "Peças produzidas com materiais de alta resistência para ambientes internos e externos.",
        },
        {
          title: "Versatilidade de tamanhos",
          text: "De pequenos vasos para mesas a grandes peças para áreas de destaque.",
        },
      ]}
      whatsappText="Olá! Gostaria de conversar com um especialista sobre vasos para minha empresa."
      ctaLabel="Fale com nosso especialista"
    />
  );
}
