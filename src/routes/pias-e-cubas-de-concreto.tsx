import { createFileRoute } from "@tanstack/react-router";
import { SeoLandingPage } from "@/components/seo-landing-page";
import { absoluteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/pias-e-cubas-de-concreto")({
  head: () => ({ meta: [
    { title: "Pias e Cubas de Concreto sob medida — Arteno" },
    { name: "description", content: "Pias e cubas de concreto sob medida para banheiros, cozinhas e áreas gourmet em Florianópolis. Escolha dimensões, cor e acabamento." },
    { property: "og:title", content: "Pias e Cubas de Concreto sob medida — Arteno" },
    { property: "og:description", content: "Design personalizado, resistência e acabamento artesanal para o seu projeto." },
    { property: "og:image", content: absoluteUrl("/images/pias-e-cubas/hero.jpg") },
    { property: "og:url", content: absoluteUrl("/pias-e-cubas-de-concreto") },
  ], links: [{ rel: "canonical", href: absoluteUrl("/pias-e-cubas-de-concreto") }]}),
  component: PiasECubasPage,
});

function PiasECubasPage() {
  return <SeoLandingPage
    eyebrow="Pias e cubas de concreto"
    title="Design sob medida para banheiros, cozinhas e áreas gourmet"
    subtitle="Peças únicas que combinam design contemporâneo, elegância e durabilidade."
    intro={[
      "As pias e cubas em concreto estão cada vez mais presentes nos projetos de arquitetura e decoração. O concreto é um material versátil, resistente e totalmente personalizável, permitindo criar peças sob medida que se adaptam perfeitamente ao espaço.",
      "Desenvolvemos soluções únicas em Florianópolis para banheiros, cozinhas, áreas de serviço e espaços gourmet, com dimensões, cores e acabamentos definidos para cada projeto.",
    ]}
    hero="/images/pias-e-cubas/hero.jpg"
    gallery={[
      { src: "/images/pias-e-cubas/cuba-vertical.jpg", alt: "Cuba de concreto artesanal sob medida" },
      { src: "/images/pias-e-cubas/cuba-artesanal.webp", alt: "Cuba de concreto com acabamento artesanal" },
      { src: "/images/pias-e-cubas/cuba-ambiente.jpg", alt: "Cuba de concreto instalada em ambiente contemporâneo" },
    ]}
    featuresTitle="Por que escolher nossas pias e cubas de concreto"
    features={[
      { title: "Acabamento sob medida", text: "Tamanho, cor e acabamento pensados exatamente para o seu espaço." },
      { title: "Estilo versátil", text: "Combina com projetos industriais, minimalistas, contemporâneos e modernos." },
      { title: "100% personalizável", text: "Executamos peças específicas a partir das necessidades do seu projeto." },
      { title: "Concreto resistente", text: "Produção cuidadosa, reforços internos, selamento e impermeabilização." },
    ]}
    faqTitle="Dúvidas comuns sobre pias e cubas de concreto"
    faqs={[
      { question: "As pias e cubas de concreto são impermeáveis?", answer: "Sim. Nossas peças recebem seladores e impermeabilização, tornando-as resistentes à água e protegidas contra manchas e infiltrações." },
      { question: "O concreto mancha ou risca com facilidade?", answer: "Com o selamento correto, o concreto é muito resistente. Cuidados simples, como limpar com pano úmido e sabão neutro, ajudam a garantir sua durabilidade." },
      { question: "Quais são as cores disponíveis?", answer: "Trabalhamos com tons que vão do branco ao cinza escuro, além de opções personalizadas sob consulta." },
      { question: "Posso escolher o tamanho e o modelo?", answer: "Sim. Você pode definir dimensões, formato, cor e acabamento." },
      { question: "Onde posso instalar uma cuba ou pia de concreto?", answer: "São indicadas para banheiros, cozinhas, áreas gourmet e ambientes externos, conforme as especificações de cada projeto." },
      { question: "O concreto pode trincar ou rachar com o tempo?", answer: "Usamos concreto de alto desempenho e reforços internos. Microfissuras superficiais podem surgir como característica natural do material sem afetar sua estrutura." },
      { question: "Quanto custa uma pia ou cuba de concreto?", answer: "O valor varia conforme tamanho, modelo e acabamento. Entre em contato para receber um orçamento." },
      { question: "Vocês fazem entrega e instalação?", answer: "Atendemos Florianópolis e região com opções de entrega e instalação, ou retirada em nosso ateliê." },
    ]}
    whatsappText="Olá! Gostaria de solicitar um orçamento para uma pia ou cuba de concreto sob medida."
    ctaLabel="Fale conosco"
  />;
}
