import jsPDF from "jspdf";
import {
  categorySlug,
  fetchProductPdfImages,
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
  const [allProducts, colors, finishes, pdfImages] = await Promise.all([
    fetchProductsWithSizes({}),
    fetchAttributeTerms("product_colors", "color_catalog"),
    fetchAttributeTerms("product_finishes", "finish_catalog"),
    fetchProductPdfImages(),
  ]);
  // A product with no priced size has nothing to quote and must not reach the catalog.
  const pdfImageByProductId = new Map(pdfImages.map((row) => [row.id, row.pdf_image_url]));
  const products = allProducts
    .filter((product) => productPriceRange(product) !== null)
    .map((product) => ({ ...product, pdf_image_url: pdfImageByProductId.get(product.id) ?? null }));
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

/**
 * Every color or finish on a single page: a grid of swatches with a link to the full,
 * browsable gallery on the site (photos, videos and descriptions live there, not here).
 */
async function addAttributeGridPage(
  pdf: jsPDF,
  title: string,
  items: AttributeTerm[],
  linkUrl: string,
  cache: ImageCache,
) {
  const margin = 15;

  pdf.addPage("a4", "p");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  addPageTitle(
    pdf,
    title,
    items.length > 0
      ? `${items.length} ${items.length === 1 ? "opção disponível" : "opções disponíveis"}`
      : undefined,
  );

  if (items.length === 0) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(105, 112, 107);
    pdf.text("Nenhum item cadastrado.", margin, 40);
    return;
  }

  const gridTop = 38;
  const linkY = pageHeight - 12;
  const gridBottom = linkY - 10;
  const columns = items.length <= 6 ? 3 : items.length <= 12 ? 4 : items.length <= 20 ? 5 : 6;
  const rows = Math.ceil(items.length / columns);
  const gap = 5;
  const captionHeight = 8;
  const cellWidth = (contentWidth - gap * (columns - 1)) / columns;
  const cellHeight = Math.max(
    16,
    Math.min(cellWidth, (gridBottom - gridTop - gap * (rows - 1)) / rows - captionHeight),
  );

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = margin + column * (cellWidth + gap);
    const y = gridTop + row * (cellHeight + captionHeight + gap);
    if (item.image_url) {
      const added = await addImageContained(
        pdf,
        item.image_url,
        x,
        y,
        cellWidth,
        cellHeight,
        cache,
        {
          fit: "cover",
        },
      );
      if (!added) addImagePlaceholder(pdf, x, y, cellWidth, cellHeight);
    } else {
      addImagePlaceholder(pdf, x, y, cellWidth, cellHeight);
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(42, 47, 44);
    pdf.text(
      pdf.splitTextToSize(item.name, cellWidth).slice(0, 1),
      x + cellWidth / 2,
      y + cellHeight + 5,
      { align: "center" },
    );
  }

  addExternalLink(pdf, `Ver todas as opções em detalhe: ${linkUrl}`, linkUrl, margin, linkY);
}

type AttributePrice = Pick<AttributeTerm, "name" | "extra_price">;
type ProductSize = NonNullable<ProductWithSizes["product_sizes"]>[number];

const TABLE_ROW_HEIGHT = 7;
const TABLE_HEADER_HEIGHT = 12;

function priceTableHeight(finishCount: number, sizeCount: number) {
  return TABLE_HEADER_HEIGHT + TABLE_ROW_HEIGHT * Math.max(1, finishCount) * Math.max(1, sizeCount);
}

/**
 * One combined price table for the whole product: every applicable finish gets its own
 * block of rows (one row per size), with its name in a merged cell on the left, in the
 * order set on the finishes admin page — not one separate table per finish anymore.
 */
function drawProductPriceTable(
  pdf: jsPDF,
  finishes: AttributePrice[],
  sizes: ProductSize[],
  variant: CatalogVariant,
  tableX: number,
  startY: number,
  tableWidth: number,
) {
  const rowLineHeight = TABLE_ROW_HEIGHT;
  const headerHeight = TABLE_HEADER_HEIGHT;
  const finishColumnWidth = tableWidth * 0.2;
  const remainingWidth = tableWidth - finishColumnWidth;
  const dimensionWidth = remainingWidth * 0.36;
  const dimensionCellWidth = dimensionWidth / 3;
  const priceWidth = remainingWidth - dimensionWidth;
  // A plain string is a single-line header; a pair stacks "Desc." over the percentage so
  // the column itself can stay narrow.
  const priceHeaders: Array<string | [string, string]> =
    variant === "reseller"
      ? ["Preço final", ["Desc.", "25%"], ["Desc.", "30%"], ["Desc.", "35%"]]
      : variant === "professional"
        ? ["Preço final", ["Desc.", "15%"]]
        : ["Preço"];
  const priceCellWidth = priceWidth / priceHeaders.length;
  const dimX = tableX + finishColumnWidth;
  const priceX0 = dimX + dimensionWidth;
  // No "R$" in the cells: with the currency established by the catalog around it, dropping
  // the prefix here is what actually lets these columns run narrower.
  const money = (value: number) => value.toFixed(2).replace(".", ",");
  const rowsPerFinish = Math.max(1, sizes.length);
  const bodyHeight = headerHeight + rowLineHeight * rowsPerFinish * Math.max(1, finishes.length);
  const tableY = startY;

  pdf.setFillColor(246, 248, 245);
  pdf.rect(tableX, tableY, tableWidth, headerHeight, "F");
  pdf.setDrawColor(218, 222, 218);
  pdf.setLineWidth(0.25);
  pdf.rect(tableX, tableY, tableWidth, bodyHeight, "S");
  pdf.line(dimX, tableY, dimX, tableY + bodyHeight);
  pdf.line(priceX0, tableY, priceX0, tableY + bodyHeight);
  for (let column = 1; column < priceHeaders.length; column += 1) {
    const x = priceX0 + priceCellWidth * column;
    pdf.line(x, tableY, x, tableY + bodyHeight);
  }
  pdf.line(dimX, tableY + 6, dimX + dimensionWidth, tableY + 6);
  for (let column = 1; column < 3; column += 1) {
    const x = dimX + dimensionCellWidth * column;
    pdf.line(x, tableY + 6, x, tableY + bodyHeight);
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(42, 47, 44);
  pdf.text("Acabamento", tableX + finishColumnWidth / 2, tableY + headerHeight / 2 + 1.2, {
    align: "center",
  });
  pdf.text("Tamanho", dimX + dimensionWidth / 2, tableY + 4, { align: "center" });
  ["Alt.", "Larg.", "Comp."].forEach((label, index) =>
    pdf.text(label, dimX + dimensionCellWidth * (index + 0.5), tableY + 10, { align: "center" }),
  );
  priceHeaders.forEach((header, index) => {
    const x = priceX0 + priceCellWidth * (index + 0.5);
    if (Array.isArray(header)) {
      pdf.text(header[0], x, tableY + 5, { align: "center" });
      pdf.text(header[1], x, tableY + 9.5, { align: "center" });
    } else {
      pdf.text(header, x, tableY + 7, { align: "center" });
    }
  });

  let rowY = tableY + headerHeight;
  (finishes.length ? finishes : [{ name: "Padrão", extra_price: 0 }]).forEach(
    (finish, finishIndex) => {
      const blockTop = rowY;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(42, 47, 44);
      sizes.forEach((size, sizeIndex) => {
        const textY = rowY + rowLineHeight * 0.68;
        if (!(finishIndex === 0 && sizeIndex === 0)) {
          pdf.setDrawColor(230, 233, 229);
          pdf.setLineWidth(0.2);
          pdf.line(tableX, rowY, tableX + tableWidth, rowY);
        }
        const rawSize = size.size || size.name || "Único";
        const dimensions = parseDims(rawSize);
        const values = dimensions
          ? [dimensions.altura, dimensions.largura, dimensions.comprimento]
          : [rawSize, "—", "—"];
        values.forEach((value, index) =>
          pdf.text(
            pdf.splitTextToSize(value, dimensionCellWidth - 2).slice(0, 1),
            dimX + dimensionCellWidth * (index + 0.5),
            textY,
            { align: "center" },
          ),
        );
        const extraPrice = Number(finish.extra_price) || 0;
        const customerFinalPrice = (size.sale_price ?? size.base_price) + extraPrice;
        const partnerPriceBase = commercialDiscountBase(size.base_price, extraPrice);
        const fullPrice =
          variant === "professional" || variant === "reseller"
            ? partnerPriceBase
            : customerFinalPrice;
        const priceX = (index: number) => priceX0 + priceCellWidth * (index + 0.5);
        if (variant === "professional" || variant === "reseller") {
          const publicPrice = money(fullPrice);
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
        }
        if (variant === "professional") {
          pdf.setFont("helvetica", "bold");
          pdf.text(money(discountedPrice(fullPrice, PROFESSIONAL_DISCOUNT)), priceX(1), textY, {
            align: "center",
          });
          pdf.setFont("helvetica", "normal");
        } else if (variant === "reseller") {
          RESELLER_TIERS.forEach((tier, tierIndex) =>
            pdf.text(
              money(discountedPrice(fullPrice, tier.discount)),
              priceX(tierIndex + 1),
              textY,
              {
                align: "center",
              },
            ),
          );
        } else {
          pdf.text(money(fullPrice), priceX(0), textY, { align: "center" });
        }
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.setTextColor(42, 47, 44);
        rowY += rowLineHeight;
      });

      const blockHeight = rowLineHeight * rowsPerFinish;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      const nameLines = pdf.splitTextToSize(finish.name, finishColumnWidth - 4).slice(0, 2);
      const lineHeight = 3.4;
      const nameStartY =
        blockTop + blockHeight / 2 - (nameLines.length * lineHeight) / 2 + lineHeight * 0.8;
      pdf.text(nameLines, tableX + finishColumnWidth / 2, nameStartY, { align: "center" });

      if (finishIndex < finishes.length - 1) {
        pdf.setDrawColor(205, 211, 206);
        pdf.setLineWidth(0.35);
        pdf.line(tableX, rowY, tableX + tableWidth, rowY);
      }
    },
  );

  return tableY + bodyHeight;
}

/**
 * The product's photos fill their whole column edge to edge — no padding, no gap between
 * two or three stacked photos — cropped (never stretched) to cover the space.
 */
async function drawImageColumn(
  pdf: jsPDF,
  images: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  cache: ImageCache,
) {
  if (images.length === 0) {
    addImagePlaceholder(pdf, x, y, width, height);
    return;
  }
  const cellHeight = height / images.length;
  for (let index = 0; index < images.length; index += 1) {
    const cellY = y + cellHeight * index;
    const added = await addImageContained(pdf, images[index], x, cellY, width, cellHeight, cache, {
      fit: "cover",
    });
    if (!added) addImagePlaceholder(pdf, x, cellY, width, cellHeight);
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
  // A single-category download only trims which PRODUCTS are included; colors and finishes
  // stay in every catalog, and so do the commercial conditions.
  const categories = options.category
    ? snapshot.categories.filter((category) => category === options.category)
    : snapshot.categories;
  const productCount = options.category
    ? snapshot.products.filter((product) => product.category === options.category).length
    : snapshot.products.length;
  const totalItems = productCount + 2;
  let completed = 0;
  const advance = () => {
    completed += 1;
    onProgress?.(Math.round((completed / Math.max(1, totalItems)) * 100));
  };

  // Commercial conditions come right after the cover, before colors/finishes/products —
  // built in this order (not inserted afterwards) so no page ever inherits the wrong
  // orientation from a page added before it.
  if (variant !== "standard") {
    pdf.addPage("a4", "p");
    addConditionsPage(pdf, variant);
  }

  // Every color and finish on its own single page, with a link to the full gallery on the
  // site, before the products — a buyer picks a finish before browsing what it comes in.
  await addAttributeGridPage(
    pdf,
    "Cores disponíveis",
    snapshot.colors,
    absoluteUrl("/acabamentos-e-cores#cores"),
    sharedImageCache,
  );
  advance();
  await addAttributeGridPage(
    pdf,
    "Acabamentos disponíveis",
    snapshot.finishes,
    absoluteUrl("/acabamentos-e-cores#acabamentos"),
    sharedImageCache,
  );
  advance();

  // Product pages: landscape, one per product, sized to fit its own content exactly — no
  // fixed height to run short against, so a product with few sizes never leaves a slab of
  // empty space and one with many finishes never gets its rows cut off. The photo takes
  // one side full-bleed (30% of the width) and the pricing the other (70%), alternating
  // sides product to product so the layout doesn't get monotonous.
  const productPageWidth = 297;
  const imageColumnWidth = productPageWidth * 0.3;
  const tableColumnWidth = productPageWidth - imageColumnWidth;
  const contentTop = 16;
  const bottomPadding = 16;
  const buttonWidth = 90;
  const buttonHeight = 10;
  let productIndex = 0;

  // Page one is reserved for the cover.
  for (const category of categories) {
    pdf.addPage("a4", "p");
    const products = snapshot.products
      .filter((product) => product.category === category)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const categoryImage = products.find((product) => product.images?.[0])?.images?.[0];
    await addCategoryCover(pdf, category, categoryImage, sharedImageCache);

    for (const product of products) {
      const sizes = product.product_sizes ?? [];
      // The order here is whatever is set on the finishes admin page (snapshot.finishes is
      // already sorted that way), not the order the finishes happen to be attached to this
      // product in.
      const productFinishNames = new Set(
        (product.product_finishes ?? []).map((relation) => relation.name),
      );
      const applicableFinishes = snapshot.finishes.filter((finish) =>
        productFinishNames.has(finish.name),
      );
      const finishesToShow: AttributePrice[] = applicableFinishes.length
        ? applicableFinishes
        : [{ name: "Padrão", extra_price: 0 }];
      const tableHeight = priceTableHeight(finishesToShow.length, sizes.length);

      const imageOnLeft = productIndex % 2 === 0;
      productIndex += 1;
      const tableX = (imageOnLeft ? imageColumnWidth : 0) + margin;
      const tableWidth = tableColumnWidth - margin * 2;

      // Measure the title before adding the page: its line count is the one thing that
      // depends on the font being set, and it decides where everything below it starts.
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      const titleLines = pdf.splitTextToSize(product.name, tableWidth).slice(0, 2);
      const titleBlockHeight = 7 + (titleLines.length - 1) * 8.5 + 6;
      const tableTop = contentTop + titleBlockHeight;
      const pageHeightForProduct = tableTop + tableHeight + 6 + buttonHeight + bottomPadding;

      pdf.addPage([productPageWidth, pageHeightForProduct], "l");

      // An admin-set featured photo replaces the gallery entirely for this column; otherwise
      // fall back to the product's own photos (up to three, stacked).
      const images = product.pdf_image_url
        ? [product.pdf_image_url]
        : (product.images ?? []).filter(Boolean).slice(0, 3);
      const imageColumnX = imageOnLeft ? 0 : productPageWidth - imageColumnWidth;
      await drawImageColumn(
        pdf,
        images,
        imageColumnX,
        0,
        imageColumnWidth,
        pageHeightForProduct,
        sharedImageCache,
      );

      pdf.setTextColor(42, 47, 44);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.text(titleLines, tableX, contentTop + 7);

      const tableBottom = drawProductPriceTable(
        pdf,
        finishesToShow,
        sizes,
        variant,
        tableX,
        tableTop,
        tableWidth,
      );

      const buttonX = tableX + (tableWidth - buttonWidth) / 2;
      const buttonY = tableBottom + 6;
      pdf.setFillColor(42, 47, 44);
      pdf.roundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 5, 5, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      pdf.text("Clique aqui para ver detalhes do produto", tableX + tableWidth / 2, buttonY + 6.4, {
        align: "center",
      });
      pdf.link(buttonX, buttonY, buttonWidth, buttonHeight, {
        url: absoluteUrl(`/produto/${product.slug}`),
      });
      advance();
    }
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

  onProgress?.(100);
  return pdf.output("blob");
}
