import jsPDF from "jspdf";
import {
  categorySlug,
  fetchProductsWithSizes,
  parseDims,
  productDescriptionToText,
  productPriceRange,
  type ProductWithSizes,
} from "./products";
import { fetchAttributeTerms, type AttributeTerm } from "./dashboard-taxonomies";
import { absoluteUrl } from "./site-config";
import {
  commercialDiscountBase,
  discountedPrice,
  PROFESSIONAL_DISCOUNT,
  RESELLER_TIERS,
} from "./commercial-rules";

export type CatalogVariant = "standard" | "professional" | "reseller";

export type CatalogSnapshot = {
  products: ProductWithSizes[];
  categories: string[];
  colors: AttributeTerm[];
  finishes: AttributeTerm[];
  coverImage: string;
  generatedAt: Date;
};

type ImageCache = Map<string, Promise<string | null>>;

const CATALOG_COVER = "/images/catalogo-capa.jpg";

export async function fetchCatalogSnapshot(): Promise<CatalogSnapshot> {
  const [allProducts, colors, finishes] = await Promise.all([
    fetchProductsWithSizes({}),
    fetchAttributeTerms("product_colors", "color_catalog"),
    fetchAttributeTerms("product_finishes", "finish_catalog"),
  ]);
  // A product with no priced size has nothing to quote and must not reach the catalog.
  const products = allProducts.filter((product) => productPriceRange(product) !== null);
  // Categories with the most products come first; ties fall back to alphabetical order.
  const categoryCounts = new Map<string, number>();
  for (const product of products) {
    if (!product.category) continue;
    categoryCounts.set(product.category, (categoryCounts.get(product.category) ?? 0) + 1);
  }
  const categories = Array.from(categoryCounts.keys()).sort(
    (a, b) =>
      (categoryCounts.get(b) ?? 0) - (categoryCounts.get(a) ?? 0) || a.localeCompare(b, "pt-BR"),
  );
  return {
    products,
    categories,
    colors,
    finishes,
    coverImage: CATALOG_COVER,
    generatedAt: new Date(),
  };
}

// Source photos come out of Supabase as WEBP at up to 2400px. jsPDF has no native WEBP
// support: it decodes the image with its own JS decoder and re-embeds the raw pixels,
// which made catalogs balloon to ~70MB. Re-encoding every photo to a modest JPEG here
// keeps the "web" quality the catalog actually needs and fixes that inflation at the
// source, on top of shrinking the file.
const CATALOG_IMAGE_MAX_DIMENSION = 1400;
const CATALOG_IMAGE_QUALITY = 0.74;

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function compressImageBlob(blob: Blob): Promise<string | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, CATALOG_IMAGE_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // Flatten onto white first: JPEG has no alpha channel.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    return canvas.toDataURL("image/jpeg", CATALOG_IMAGE_QUALITY);
  } catch {
    return null;
  }
}

async function loadImageAsDataUrl(url: string, cache: ImageCache): Promise<string | null> {
  if (!cache.has(url)) {
    cache.set(
      url,
      (async () => {
        try {
          const response = await fetch(url, { mode: "cors" });
          if (!response.ok) return null;
          const blob = await response.blob();
          return (await compressImageBlob(blob)) ?? (await blobToDataUrl(blob));
        } catch {
          return null;
        }
      })(),
    );
  }
  return cache.get(url)!;
}

function imageFormat(dataUrl: string): "PNG" | "JPEG" | "WEBP" {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

async function addImageContained(
  pdf: jsPDF,
  url: string,
  x: number,
  y: number,
  width: number,
  height: number,
  cache: ImageCache,
  options: { fit?: "contain" | "cover"; align?: "center" | "top" } = {},
) {
  const dataUrl = await loadImageAsDataUrl(url, cache);
  if (!dataUrl) return false;
  try {
    const format = imageFormat(dataUrl);
    const { width: naturalWidth, height: naturalHeight } = pdf.getImageProperties(dataUrl);
    const scale =
      options.fit === "cover"
        ? Math.max(width / naturalWidth, height / naturalHeight)
        : Math.min(width / naturalWidth, height / naturalHeight);
    const drawWidth = naturalWidth * scale;
    const drawHeight = naturalHeight * scale;
    const drawX = x + (width - drawWidth) / 2;
    const drawY = options.align === "top" ? y : y + (height - drawHeight) / 2;
    if (options.fit === "cover") {
      // Clip to the target box so the cropped overflow is not drawn.
      pdf.saveGraphicsState();
      pdf.rect(x, y, width, height, null);
      pdf.clip();
      pdf.discardPath();
      pdf.addImage(dataUrl, format, drawX, drawY, drawWidth, drawHeight, undefined, "FAST");
      pdf.restoreGraphicsState();
    } else {
      pdf.addImage(dataUrl, format, drawX, drawY, drawWidth, drawHeight, undefined, "FAST");
    }
    return true;
  } catch {
    return false;
  }
}

function addPageTitle(pdf: jsPDF, title: string, subtitle?: string) {
  pdf.setTextColor(42, 47, 44);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text(title, 15, 20);
  if (subtitle) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(105, 112, 107);
    pdf.text(subtitle, 15, 27);
  }
}

function addCategoryTitle(pdf: jsPDF, category: string) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const x = 15;
  const y = 10;
  const width = pageWidth - 30;
  const height = 24;
  pdf.setFillColor(42, 47, 44);
  pdf.roundedRect(x, y, width, height, 6, 6, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text(category, pageWidth / 2, 21, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(222, 226, 222);
  pdf.text("Produtos Arteno", pageWidth / 2, 28, { align: "center" });
}

async function addCategoryCover(
  pdf: jsPDF,
  category: string,
  imageUrl: string | undefined,
  cache: ImageCache,
) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  if (imageUrl) {
    const added = await addImageContained(pdf, imageUrl, 0, 0, pageWidth, pageHeight, cache, {
      fit: "cover",
    });
    if (!added) addImagePlaceholder(pdf, 0, 0, pageWidth, pageHeight);
  } else {
    pdf.setFillColor(236, 239, 234);
    pdf.rect(0, 0, pageWidth, pageHeight, "F");
  }
  pdf.setFillColor(42, 47, 44);
  pdf.rect(0, pageHeight * 0.62, pageWidth, pageHeight * 0.38, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("COLEÇÃO ARTENO", pageWidth / 2, pageHeight * 0.7, { align: "center" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(46);
  const lines = pdf.splitTextToSize(category, pageWidth - 40).slice(0, 2);
  pdf.text(lines, pageWidth / 2, pageHeight * 0.7 + 20, {
    align: "center",
    lineHeightFactor: 1.05,
  });
}

function addAttributeTitle(pdf: jsPDF, section: string, item: string, continuation = false) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  pdf.setTextColor(105, 112, 107);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text(
    continuation ? `${section.toUpperCase()} — CONTINUAÇÃO` : section.toUpperCase(),
    pageWidth / 2,
    16,
    { align: "center" },
  );
  pdf.setTextColor(42, 47, 44);
  pdf.setFontSize(24);
  pdf.text(item, pageWidth / 2, 27, { align: "center" });
}

function addImagePlaceholder(pdf: jsPDF, x: number, y: number, width: number, height: number) {
  pdf.setFillColor(242, 244, 241);
  pdf.setDrawColor(205, 211, 206);
  pdf.rect(x, y, width, height, "FD");
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  pdf.setDrawColor(145, 153, 147);
  pdf.setLineWidth(0.7);
  pdf.rect(centerX - 11, centerY - 9, 22, 16);
  pdf.circle(centerX + 5, centerY - 4, 2);
  pdf.line(centerX - 9, centerY + 4, centerX - 3, centerY - 2);
  pdf.line(centerX - 3, centerY - 2, centerX + 2, centerY + 3);
  pdf.line(centerX + 2, centerY + 3, centerX + 7, centerY - 1);
  pdf.line(centerX + 7, centerY - 1, centerX + 10, centerY + 3);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(120, 128, 122);
  pdf.text("Imagem não disponível", centerX, centerY + 16, { align: "center" });
}

function addExternalLink(pdf: jsPDF, label: string, url: string, x: number, y: number) {
  pdf.setTextColor(25, 92, 150);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(label, x, y);
  pdf.link(x, y - 4, Math.max(25, pdf.getTextWidth(label)), 6, { url });
  pdf.setTextColor(42, 47, 44);
}

type FinishGroup = { extraPrice: number; names: string[] };
type ProductSize = NonNullable<ProductWithSizes["product_sizes"]>[number];

const TABLE_ROW_HEIGHT = 7;
const TABLE_HEADER_HEIGHT = 12;
const GROUP_TITLE_HEIGHT = 7;
const GROUP_GAP = 5;

function finishGroupHeight(sizeCount: number) {
  return GROUP_TITLE_HEIGHT + TABLE_HEADER_HEIGHT + TABLE_ROW_HEIGHT * Math.max(1, sizeCount);
}

/** Draws one finish group (title + price table) and returns the y where it ends. */
function drawFinishTable(
  pdf: jsPDF,
  group: FinishGroup,
  sizes: ProductSize[],
  variant: CatalogVariant,
  tableX: number,
  startY: number,
  tableWidth: number,
) {
  const rowLineHeight = TABLE_ROW_HEIGHT;
  const headerHeight = TABLE_HEADER_HEIGHT;
  const dimensionWidth = tableWidth * 0.38;
  const dimensionCellWidth = dimensionWidth / 3;
  const priceWidth = tableWidth - dimensionWidth;
  const priceHeaders =
    variant === "reseller"
      ? ["Preço final", "25%", "30%", "35%"]
      : variant === "professional"
        ? ["Preço final", "Prof. 15%"]
        : ["Preço"];
  const priceCellWidth = priceWidth / priceHeaders.length;
  const brl = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;
  let tableY = startY;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(42, 47, 44);
  const title = `${group.names.length > 1 ? "Acabamentos" : "Acabamento"}: ${group.names.join(", ")}`;
  pdf.text(pdf.splitTextToSize(title, tableWidth).slice(0, 1), tableX, tableY + 4);
  tableY += GROUP_TITLE_HEIGHT;
  const bodyHeight = headerHeight + rowLineHeight * Math.max(1, sizes.length);
  pdf.setFillColor(246, 248, 245);
  pdf.rect(tableX, tableY, tableWidth, headerHeight, "F");
  pdf.setDrawColor(218, 222, 218);
  pdf.setLineWidth(0.25);
  pdf.rect(tableX, tableY, tableWidth, bodyHeight, "S");
  pdf.line(tableX + dimensionWidth, tableY, tableX + dimensionWidth, tableY + bodyHeight);
  for (let column = 1; column < priceHeaders.length; column += 1) {
    const x = tableX + dimensionWidth + priceCellWidth * column;
    pdf.line(x, tableY, x, tableY + bodyHeight);
  }
  pdf.line(tableX, tableY + 6, tableX + dimensionWidth, tableY + 6);
  for (let column = 1; column < 3; column += 1) {
    const x = tableX + dimensionCellWidth * column;
    pdf.line(x, tableY + 6, x, tableY + bodyHeight);
  }
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.text("Tamanho", tableX + dimensionWidth / 2, tableY + 4, { align: "center" });
  ["Alt.", "Larg.", "Comp."].forEach((label, index) =>
    pdf.text(label, tableX + dimensionCellWidth * (index + 0.5), tableY + 10, {
      align: "center",
    }),
  );
  priceHeaders.forEach((label, index) =>
    pdf.text(label, tableX + dimensionWidth + priceCellWidth * (index + 0.5), tableY + 7, {
      align: "center",
    }),
  );
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  sizes.forEach((size, sizeIndex) => {
    const rowY = tableY + headerHeight + rowLineHeight * sizeIndex;
    const textY = rowY + rowLineHeight * 0.68;
    pdf.line(tableX, rowY, tableX + tableWidth, rowY);
    const rawSize = size.size || size.name || "Único";
    const dimensions = parseDims(rawSize);
    const values = dimensions
      ? [dimensions.altura, dimensions.largura, dimensions.comprimento]
      : [rawSize, "—", "—"];
    values.forEach((value, index) =>
      pdf.text(
        pdf.splitTextToSize(value, dimensionCellWidth - 2).slice(0, 1),
        tableX + dimensionCellWidth * (index + 0.5),
        textY,
        { align: "center" },
      ),
    );
    const customerFinalPrice = (size.sale_price ?? size.base_price) + group.extraPrice;
    const partnerPriceBase = commercialDiscountBase(size.base_price, group.extraPrice);
    const fullPrice =
      variant === "professional" || variant === "reseller" ? partnerPriceBase : customerFinalPrice;
    const priceX = (index: number) => tableX + dimensionWidth + priceCellWidth * (index + 0.5);
    if (variant === "professional" || variant === "reseller") {
      const publicPrice = brl(fullPrice);
      pdf.text(publicPrice, priceX(0), textY, { align: "center" });
      const publicTextWidth = pdf.getTextWidth(publicPrice);
      // Strike-through in the same dark tone as the price, not the table's light border color.
      pdf.setDrawColor(42, 47, 44);
      pdf.setLineWidth(0.3);
      pdf.line(
        priceX(0) - publicTextWidth / 2,
        textY - 1.2,
        priceX(0) + publicTextWidth / 2,
        textY - 1.2,
      );
      pdf.setDrawColor(218, 222, 218);
      pdf.setLineWidth(0.25);
    }
    if (variant === "professional") {
      pdf.setFont("helvetica", "bold");
      pdf.text(brl(discountedPrice(fullPrice, PROFESSIONAL_DISCOUNT)), priceX(1), textY, {
        align: "center",
      });
      pdf.setFont("helvetica", "normal");
    } else if (variant === "reseller") {
      RESELLER_TIERS.forEach((tier, tierIndex) =>
        pdf.text(brl(discountedPrice(fullPrice, tier.discount)), priceX(tierIndex + 1), textY, {
          align: "center",
        }),
      );
    } else {
      pdf.text(brl(fullPrice), priceX(0), textY, { align: "center" });
    }
  });
  return tableY + bodyHeight;
}

/** Up to three product photos: one large, side by side, or one large plus two stacked. */
async function drawProductImages(
  pdf: jsPDF,
  images: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  cache: ImageCache,
) {
  const gap = 4;
  const boxes: Array<[number, number, number, number]> =
    images.length >= 3
      ? (() => {
          const mainWidth = (width - gap) * 0.6;
          const sideWidth = width - gap - mainWidth;
          const sideHeight = (height - gap) / 2;
          return [
            [x, y, mainWidth, height],
            [x + mainWidth + gap, y, sideWidth, sideHeight],
            [x + mainWidth + gap, y + sideHeight + gap, sideWidth, sideHeight],
          ];
        })()
      : images.length === 2
        ? [
            [x, y, (width - gap) / 2, height],
            [x + (width + gap) / 2, y, (width - gap) / 2, height],
          ]
        : [[x, y, width, height]];

  if (images.length === 0) {
    addImagePlaceholder(pdf, x, y, width, height);
    return;
  }
  for (let index = 0; index < boxes.length; index++) {
    const [boxX, boxY, boxWidth, boxHeight] = boxes[index];
    const added = await addImageContained(
      pdf,
      images[index],
      boxX + 2,
      boxY + 2,
      boxWidth - 4,
      boxHeight - 4,
      cache,
    );
    if (!added) addImagePlaceholder(pdf, boxX, boxY, boxWidth, boxHeight);
  }
}

function formatMoney(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function addConditionsPage(pdf: jsPDF, variant: "professional" | "reseller") {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const isReseller = variant === "reseller";

  pdf.setFillColor(42, 47, 44);
  pdf.rect(0, 0, pageWidth, 62, "F");
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(200, 206, 201);
  pdf.text("CATÁLOGO ARTENO", margin, 24);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(28);
  pdf.setTextColor(255, 255, 255);
  pdf.text(isReseller ? "Condições para revendedores" : "Condições para profissionais", margin, 38);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(222, 226, 222);
  pdf.text(
    isReseller
      ? "Descontos progressivos exclusivos para parceiros aprovados."
      : "Condição especial para arquitetos, paisagistas, designers e especificadores.",
    margin,
    49,
  );

  const sectionLabel = (label: string, y: number) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(105, 112, 107);
    pdf.text(label, margin, y);
  };

  let y = 80;
  if (isReseller) {
    sectionLabel("FAIXAS DE DESCONTO", y);
    y += 6;
    const gap = 6;
    const cardWidth = (contentWidth - gap * (RESELLER_TIERS.length - 1)) / RESELLER_TIERS.length;
    const cardHeight = 52;
    RESELLER_TIERS.forEach((tier, index) => {
      const next = RESELLER_TIERS[index + 1];
      const x = margin + index * (cardWidth + gap);
      const centerX = x + cardWidth / 2;
      const highlighted = index === RESELLER_TIERS.length - 1;
      if (highlighted) pdf.setFillColor(42, 47, 44);
      else pdf.setFillColor(242, 244, 241);
      pdf.roundedRect(x, y, cardWidth, cardHeight, 4, 4, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(32);
      if (highlighted) pdf.setTextColor(255, 255, 255);
      else pdf.setTextColor(42, 47, 44);
      pdf.text(`${Math.round(tier.discount * 100)}%`, centerX, y + 22, { align: "center" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      if (highlighted) pdf.setTextColor(222, 226, 222);
      else pdf.setTextColor(105, 112, 107);
      pdf.text("de desconto", centerX, y + 29, { align: "center" });
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      if (highlighted) pdf.setTextColor(255, 255, 255);
      else pdf.setTextColor(42, 47, 44);
      pdf.text(
        next
          ? `${formatMoney(tier.minimum)} a ${formatMoney(next.minimum - 0.01)}`
          : `A partir de ${formatMoney(tier.minimum)}`,
        centerX,
        y + 40,
        { align: "center" },
      );
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      if (highlighted) pdf.setTextColor(222, 226, 222);
      else pdf.setTextColor(105, 112, 107);
      pdf.text("em produtos por pedido", centerX, y + 46, { align: "center" });
    });
    y += cardHeight + 18;
  } else {
    sectionLabel("DESCONTO", y);
    y += 6;
    const cardHeight = 44;
    pdf.setFillColor(42, 47, 44);
    pdf.roundedRect(margin, y, contentWidth, cardHeight, 4, 4, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(40);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`${Math.round(PROFESSIONAL_DISCOUNT * 100)}%`, margin + 12, y + 28);
    pdf.setFontSize(13);
    pdf.text("de desconto sobre a tabela", margin + 62, y + 20);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.setTextColor(222, 226, 222);
    pdf.text("Válido para profissionais e especificadores.", margin + 62, y + 28);
    y += cardHeight + 18;
  }

  sectionLabel("COMO FUNCIONA", y);
  y += 9;
  const rules: Array<[string, string]> = isReseller
    ? [
        [
          "Primeiro pedido",
          `Pedido mínimo de ${formatMoney(RESELLER_TIERS[0].minimum)} em produtos.`,
        ],
        ["Frete", "O valor do frete não entra no cálculo das faixas de desconto."],
        [
          "Manutenção da parceria",
          "Vinculada a R$ 6.000 em compras a cada seis meses, sujeita a reavaliação.",
        ],
      ]
    : [
        [
          "Para quem",
          "Arquitetos, paisagistas, designers de interiores, jardineiros e especificadores.",
        ],
        ["Modalidade", "Esta condição é destinada a especificação e não caracteriza revenda."],
      ];
  for (const [label, description] of rules) {
    pdf.setFillColor(42, 47, 44);
    pdf.circle(margin + 2, y - 1.3, 1.3, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(42, 47, 44);
    pdf.text(label, margin + 8, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(65, 72, 67);
    const lines = pdf.splitTextToSize(description, contentWidth - 8);
    pdf.text(lines, margin + 8, y + 6);
    y += 6 + lines.length * 4.6 + 6;
    pdf.setDrawColor(225, 229, 225);
    pdf.setLineWidth(0.25);
    pdf.line(margin, y - 3, margin + contentWidth, y - 3);
    y += 4;
  }

  y += 4;
  const notice = isReseller
    ? "Condições exclusivas para parceiros aprovados. O valor do pedido ou o download deste catálogo não concedem aprovação como revendedor."
    : "O download deste catálogo não representa aprovação automática como parceiro.";
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  const noticeLines = pdf.splitTextToSize(notice, contentWidth - 16);
  const noticeHeight = noticeLines.length * 4.4 + 10;
  pdf.setDrawColor(205, 211, 206);
  pdf.setFillColor(250, 250, 247);
  pdf.roundedRect(margin, y, contentWidth, noticeHeight, 3, 3, "FD");
  pdf.setTextColor(90, 97, 92);
  pdf.text(noticeLines, margin + 8, y + 7.5);
}

export async function buildCatalogPDF(
  snapshot: CatalogSnapshot,
  variant: CatalogVariant,
  onProgress?: (percent: number) => void,
  sharedImageCache: ImageCache = new Map(),
  options: { category?: string } = {},
): Promise<Blob> {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  // A single-category download skips the shared color/finish galleries: it exists to be a
  // smaller, faster file focused on that category, not a trimmed copy of the full catalog.
  const categories = options.category
    ? snapshot.categories.filter((category) => category === options.category)
    : snapshot.categories;
  const includeAttributeSections = !options.category;
  const productCount = options.category
    ? snapshot.products.filter((product) => product.category === options.category).length
    : snapshot.products.length;
  const totalItems =
    productCount +
    (includeAttributeSections ? snapshot.colors.length + snapshot.finishes.length : 0);
  let completed = 0;
  const advance = () => {
    completed += 1;
    onProgress?.(Math.round((completed / Math.max(1, totalItems)) * 100));
  };

  // Product cards: one product per page, bordered card that always wraps its tables.
  const cardTop = 20;
  const cardBottomLimit = pageHeight - 14;
  const padding = 8;
  const innerX = margin + padding;
  const innerWidth = contentWidth - padding * 2;
  const buttonWidth = 90;
  const buttonHeight = 10;
  const footerBlock = 6 + buttonHeight + padding;

  const startProductPage = (category: string) => {
    pdf.addPage();
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(125, 130, 126);
    pdf.text(category.toUpperCase(), margin, 14);
  };
  const drawCardBorder = (bottom: number) => {
    pdf.setDrawColor(205, 211, 206);
    pdf.setLineWidth(0.35);
    pdf.rect(margin, cardTop, contentWidth, bottom - cardTop, "S");
  };

  // Page one is reserved for the cover.
  for (const category of categories) {
    pdf.addPage();
    const products = snapshot.products
      .filter((product) => product.category === category)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const categoryImage = products.find((product) => product.images?.[0])?.images?.[0];
    await addCategoryCover(pdf, category, categoryImage, sharedImageCache);

    for (const product of products) {
      const sizes = product.product_sizes ?? [];
      const applicableFinishes = (product.product_finishes ?? [])
        .map((relation) => snapshot.finishes.find((finish) => finish.name === relation.name))
        .filter((finish): finish is AttributeTerm => Boolean(finish));
      const priceFinishes = applicableFinishes.length
        ? applicableFinishes
        : [{ name: "Padrão", extra_price: 0 } as AttributeTerm];
      const finishGroups = Array.from(
        priceFinishes.reduce((groups, finish) => {
          const key = Math.round((Number(finish.extra_price) || 0) * 100);
          const group = groups.get(key) ?? { extraPrice: key / 100, names: [] as string[] };
          group.names.push(finish.name);
          groups.set(key, group);
          return groups;
        }, new Map<number, FinishGroup>()),
      ).map(([, group]) => group);
      const groupHeight = finishGroupHeight(sizes.length);
      const tablesHeight =
        finishGroups.length * groupHeight + GROUP_GAP * Math.max(0, finishGroups.length - 1);

      startProductPage(category);
      pdf.setTextColor(42, 47, 44);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      const titleLines = pdf.splitTextToSize(product.name, innerWidth).slice(0, 2);
      const titleY = cardTop + padding + 7;
      pdf.text(titleLines, innerX, titleY);
      const imagesTop = titleY + (titleLines.length - 1) * 8.5 + 6;

      // Photos take whatever height the tables leave, within sensible bounds.
      const images = (product.images ?? []).filter(Boolean).slice(0, 3);
      const available = cardBottomLimit - imagesTop - 8 - tablesHeight - footerBlock;
      const imageHeight = Math.max(60, Math.min(images.length === 1 ? 150 : 125, available));
      await drawProductImages(
        pdf,
        images,
        innerX,
        imagesTop,
        innerWidth,
        imageHeight,
        sharedImageCache,
      );

      let tableY = imagesTop + imageHeight + 8;
      finishGroups.forEach((group, index) => {
        const isLast = index === finishGroups.length - 1;
        const needed = groupHeight + (isLast ? footerBlock : 0);
        if (tableY + needed > cardBottomLimit) {
          // Close this card and continue the remaining tables on a new page.
          drawCardBorder(tableY - GROUP_GAP + padding);
          startProductPage(category);
          pdf.setTextColor(42, 47, 44);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(13);
          pdf.text(
            pdf.splitTextToSize(`${product.name} (continuação)`, innerWidth).slice(0, 1),
            innerX,
            cardTop + padding + 5,
          );
          tableY = cardTop + padding + 12;
        }
        tableY = drawFinishTable(pdf, group, sizes, variant, innerX, tableY, innerWidth);
        tableY += GROUP_GAP;
      });
      tableY -= GROUP_GAP;

      const buttonX = margin + (contentWidth - buttonWidth) / 2;
      const buttonY = tableY + 6;
      pdf.setFillColor(42, 47, 44);
      pdf.roundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 5, 5, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      pdf.text("Clique aqui para ver detalhes do produto", pageWidth / 2, buttonY + 6.4, {
        align: "center",
      });
      pdf.link(buttonX, buttonY, buttonWidth, buttonHeight, {
        url: absoluteUrl(`/produto/${product.slug}`),
      });
      drawCardBorder(buttonY + buttonHeight + padding);
      advance();
    }
  }

  async function addAttributeSection(title: string, items: AttributeTerm[]) {
    if (items.length === 0) {
      pdf.addPage();
      addPageTitle(pdf, title);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text("Nenhum item cadastrado.", margin, 40);
    }
    for (const item of items) {
      const media = [item.image_url, ...item.gallery].filter((url): url is string => Boolean(url));
      const mediaPages: string[][] = [];
      for (let start = 0; start < media.length; start += 4) {
        mediaPages.push(media.slice(start, start + 4));
      }
      if (mediaPages.length === 0) mediaPages.push([]);

      for (let mediaPage = 0; mediaPage < mediaPages.length; mediaPage++) {
        pdf.addPage();
        addAttributeTitle(pdf, title, item.name, mediaPage > 0);
        const positions = [
          [15, 42],
          [107, 42],
          [15, 130],
          [107, 130],
        ] as const;
        const pageMedia = mediaPages[mediaPage];
        if (pageMedia.length === 0) {
          addImagePlaceholder(pdf, 15, 42, contentWidth, 100);
        } else {
          for (let index = 0; index < pageMedia.length; index++) {
            const [x, y] = positions[index];
            const added = await addImageContained(
              pdf,
              pageMedia[index],
              x,
              y,
              84,
              78,
              sharedImageCache,
            );
            if (!added) addImagePlaceholder(pdf, x, y, 84, 78);
          }
        }
        if (mediaPage === mediaPages.length - 1) {
          let footerY = pageMedia.length === 0 ? 154 : pageMedia.length > 2 ? 222 : 130;
          if (item.description) {
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(10);
            pdf.setTextColor(42, 47, 44);
            const lines = pdf.splitTextToSize(item.description, contentWidth).slice(0, 10);
            pdf.text(lines, margin, footerY);
            footerY += lines.length * 4.5 + 4;
          }
          if (item.video_url) {
            addExternalLink(
              pdf,
              `Assistir no YouTube: ${item.video_url}`,
              item.video_url,
              margin,
              footerY,
            );
          }
        }
      }
      advance();
    }
  }

  if (includeAttributeSections) {
    await addAttributeSection("Cores disponíveis", snapshot.colors);
    await addAttributeSection("Acabamentos disponíveis", snapshot.finishes);
  }

  if (variant !== "standard") {
    pdf.insertPage(2);
    pdf.setPage(2);
    addConditionsPage(pdf, variant);
  }

  // Cover: brand artwork with the edition on top and the audience at the bottom.
  pdf.setPage(1);
  pdf.setFillColor(10, 57, 62);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");
  await addImageContained(pdf, snapshot.coverImage, 0, 0, pageWidth, pageHeight, sharedImageCache, {
    fit: "cover",
  });
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(20);
  pdf.text(`Catálogo ${snapshot.generatedAt.getFullYear()}`, pageWidth / 2, 42, {
    align: "center",
    charSpace: 0.6,
  });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(13);
  pdf.text(
    variant === "reseller"
      ? "Revendedores / Lojistas"
      : variant === "professional"
        ? "Profissionais / Especificadores"
        : "Cliente final",
    pageWidth / 2,
    pageHeight - 36,
    { align: "center", charSpace: 0.3 },
  );

  const totalPages = pdf.getNumberOfPages();
  for (let page = 2; page <= totalPages; page++) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(125, 130, 126);
    pdf.text(`Página ${page} de ${totalPages}`, pageWidth / 2, pageHeight - 7, { align: "center" });
  }
  onProgress?.(100);
  return pdf.output("blob");
}
