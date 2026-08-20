import { productDescriptionToText, type ProductDetail } from "@/lib/products";

type ProductKind = "vaso" | "jardineira" | "mesa" | "banco" | "outro";

export type ProductEditorialContent = {
  introduction: string;
  selectionGuide: string;
  planningGuide: string;
  orderingGuide: string;
  dimensions: string[];
  finishes: string[];
  colors: string[];
  faq: Array<{ question: string; answer: string }>;
};

function productKind(product: Pick<ProductDetail, "name" | "category">): ProductKind {
  const value = `${product.name} ${product.category}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (value.includes("jardineira")) return "jardineira";
  if (value.includes("vaso")) return "vaso";
  if (value.includes("mesa")) return "mesa";
  if (value.includes("banco") || value.includes("banqueta")) return "banco";
  return "outro";
}

function cleanSize(value: string | null | undefined) {
  if (!value) return "";
  const separator = value.indexOf("|");
  return (separator >= 0 ? value.slice(separator + 1) : value).trim();
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
}

const kindCopy: Record<ProductKind, { introduction: string; selection: string; planning: string }> =
  {
    vaso: {
      introduction:
        "faz parte da coleção de vasos da Arteno e pode ser configurado de acordo com a composição do projeto. As opções cadastradas nesta página permitem comparar medidas, acabamento e cor antes de enviar o item para orçamento.",
      selection:
        "Para escolher um vaso, observe a proporção entre a peça, a planta e o espaço disponível. Compare a altura, a largura e o comprimento informados na tabela e considere também a área necessária para circulação e manutenção. Em projetos com mais de uma unidade, repetir a cor ou o acabamento ajuda a criar continuidade visual.",
      planning:
        "No planejamento do ambiente, marque no piso a área correspondente à medida escolhida. Essa verificação simples ajuda a visualizar a escala do vaso antes do pedido. Para composições, compare as diferentes alturas disponíveis e organize as peças sem bloquear passagens, portas ou outros pontos de uso do espaço.",
    },
    jardineira: {
      introduction:
        "integra a linha de jardineiras da Arteno e oferece configurações para diferentes composições de paisagismo. Medidas, acabamento e cor podem ser avaliados nesta página antes de o produto ser incluído no orçamento.",
      selection:
        "Na escolha de uma jardineira, confira o comprimento disponível, a profundidade necessária para o plantio e a circulação ao redor da peça. Quando houver mais de um tamanho, use a tabela para comparar as proporções. A combinação de cor e acabamento também pode aproximar a jardineira dos demais elementos do ambiente.",
      planning:
        "Antes do pedido, reserve no projeto a área exata da jardineira e verifique sua relação com paredes, passagens e demais elementos. Quando a composição usar peças em sequência, considere o comprimento total do conjunto e os intervalos entre unidades. A escolha da vegetação e as condições do local devem ser avaliadas separadamente no projeto de paisagismo.",
    },
    mesa: {
      introduction:
        "faz parte da coleção de mesas da Arteno e pode ser personalizado com as opções disponíveis para o modelo. A página reúne as medidas, os acabamentos e as cores cadastradas para facilitar a comparação antes da solicitação de orçamento.",
      selection:
        "Antes de escolher a mesa, confira as dimensões do tampo, a altura e a área livre necessária para circulação. As medidas da tabela ajudam a verificar a escala da peça em relação ao ambiente. Cor e acabamento podem ser combinados com outros elementos do projeto para criar contraste ou continuidade visual.",
      planning:
        "Para visualizar a ocupação da mesa, reproduza no piso as dimensões informadas e confira o espaço livre ao redor. Considere a posição de cadeiras, poltronas ou outros móveis que façam parte da composição. Essa leitura prévia reduz dúvidas sobre proporção e facilita a escolha entre as medidas disponíveis.",
    },
    banco: {
      introduction:
        "pertence à coleção de bancos e banquetas da Arteno e pode ser configurado a partir das opções cadastradas para o modelo. Nesta página é possível consultar medidas, acabamentos e cores antes de incluir a peça no orçamento.",
      selection:
        "Para definir o banco ou a banqueta, compare altura, largura e comprimento com o local de uso e preserve uma passagem confortável ao redor da peça. Se o projeto utilizar várias unidades, as opções de cor e acabamento ajudam a manter uma linguagem visual consistente.",
      planning:
        "No estudo do espaço, confira a área ocupada pela peça e sua relação com mesas, paredes e rotas de circulação. Quando houver mais de um banco, some os comprimentos e preveja os intervalos entre as unidades. A tabela desta página concentra as medidas cadastradas para apoiar essa conferência.",
    },
    outro: {
      introduction:
        "faz parte do catálogo da Arteno e reúne nesta página as configurações disponíveis para o modelo. Consulte medidas, acabamentos e cores cadastrados antes de incluir o item na solicitação de orçamento.",
      selection:
        "Para escolher a configuração, confira as dimensões do local de uso e compare todas as opções disponíveis. A seleção de cor e acabamento deve considerar os demais materiais e elementos presentes no ambiente.",
      planning:
        "Antes de solicitar o orçamento, confira a área disponível e compare os dados cadastrados nesta página com as necessidades do projeto. Se houver alguma medida ou configuração a confirmar, registre essa informação no atendimento para que a equipe possa orientar a escolha.",
    },
  };

export function buildProductEditorialContent(product: ProductDetail): ProductEditorialContent {
  const kind = productKind(product);
  const copy = kindCopy[kind];
  const dimensions = unique(
    [...(product.product_sizes ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((size) => cleanSize(size.name || size.size)),
  );
  const finishes = unique(
    [...(product.product_finishes ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => item.name),
  );
  const colors = unique(
    [...(product.product_colors ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => item.name),
  );
  const sizeAnswer = dimensions.length
    ? `Sim. ${product.name} possui ${dimensions.length === 1 ? "a medida cadastrada" : `${dimensions.length} medidas cadastradas`}: ${dimensions.join(", ")}. Consulte a tabela de tamanhos para comparar preços e selecionar a opção desejada.`
    : `As medidas de ${product.name} devem ser confirmadas no atendimento antes da finalização do orçamento.`;
  const availableOptions = [
    finishes.length
      ? `${finishes.length} ${finishes.length === 1 ? "opção de acabamento" : "opções de acabamento"}`
      : "",
    colors.length
      ? `${colors.length} ${colors.length === 1 ? "opção de cor" : "opções de cor"}`
      : "",
  ].filter(Boolean);
  const customizationAnswer = availableOptions.length
    ? `Sim. Para este modelo, a página apresenta ${availableOptions.join(" e ")}. A disponibilidade exibida corresponde ao cadastro atual do produto.`
    : "As opções de personalização devem ser confirmadas com a equipe no momento do orçamento.";

  return {
    introduction: `${product.name} ${copy.introduction}`,
    selectionGuide: copy.selection,
    planningGuide: copy.planning,
    orderingGuide: `Este produto é apresentado sob encomenda. Escolha uma medida disponível, selecione acabamento e cor e adicione a configuração ao orçamento. O pedido só é enviado depois da revisão dos itens, portanto é possível comparar alternativas antes de informar os dados para atendimento. Como as opções vêm diretamente do cadastro de ${product.name}, futuras atualizações de tamanhos, cores ou acabamentos passam a aparecer automaticamente nesta página.`,
    dimensions,
    finishes,
    colors,
    faq: [
      { question: `${product.name} possui mais de um tamanho?`, answer: sizeAnswer },
      { question: "É possível escolher cor e acabamento?", answer: customizationAnswer },
      {
        question: "Como solicitar um orçamento?",
        answer: `Selecione o tamanho de ${product.name}, escolha o acabamento e a cor disponíveis e adicione a configuração ao orçamento. Depois, revise os itens escolhidos e envie seus dados para atendimento.`,
      },
    ],
  };
}

export function productEditorialText(product: ProductDetail) {
  const content = buildProductEditorialContent(product);
  return [
    productDescriptionToText(product.description),
    content.introduction,
    content.selectionGuide,
    content.planningGuide,
    content.orderingGuide,
    ...content.faq.map((item) => `${item.question} ${item.answer}`),
  ]
    .filter(Boolean)
    .join(" ");
}
