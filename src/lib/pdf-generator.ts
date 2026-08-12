import jsPDF from "jspdf";
import {
  categorySlug,
  fetchProductsWithSizes,
  parseDims,
  productDescriptionToText,
  type ProductWithSizes,
} from "./products";
import { fetchAttributeTerms, type AttributeTerm } from "./dashboard-taxonomies";
import { absoluteUrl } from "./site-config";
import { fetchHeroSlides } from "./hero-slides";

export type CatalogVariant = "standard" | "reseller";

export type CatalogSnapshot = {
  products: ProductWithSizes[];
  categories: string[];
  colors: AttributeTerm[];
  finishes: AttributeTerm[];
  coverImage: string | null;
  generatedAt: Date;
};

const RESELLER_DISCOUNT = 0.3;
type ImageCache = Map<string, Promise<string | null>>;

export async function fetchCatalogSnapshot(): Promise<CatalogSnapshot> {
  const [products, colors, finishes, slides] = await Promise.all([
    fetchProductsWithSizes({}),
    fetchAttributeTerms("product_colors", "color_catalog"),
    fetchAttributeTerms("product_finishes", "finish_catalog"),
    fetchHeroSlides(),
  ]);
  const categories = Array.from(
    new Set(products.map((product) => product.category).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    products,
    categories,
    colors,
    finishes,
    coverImage: slides[0]?.image ?? null,
    generatedAt: new Date(),
  };
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
          return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
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
) {
  const dataUrl = await loadImageAsDataUrl(url, cache);
  if (!dataUrl) return false;
  try {
    pdf.addImage(dataUrl, imageFormat(dataUrl), x, y, width, height, undefined, "FAST");
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
    const added = await addImageContained(pdf, imageUrl, 0, 0, pageWidth, pageHeight, cache);
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
  pdf.setFontSize(30);
  pdf.text(category, pageWidth / 2, pageHeight * 0.77, { align: "center" });
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

function addBackToIndex(pdf: jsPDF) {
  const pageHeight = pdf.internal.pageSize.getHeight();
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(70, 95, 88);
  pdf.text("Voltar ao índice", 15, pageHeight - 7);
  pdf.link(15, pageHeight - 12, 28, 7, { pageNumber: 1 });
}

function addExternalLink(pdf: jsPDF, label: string, url: string, x: number, y: number) {
  pdf.setTextColor(25, 92, 150);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(label, x, y);
  pdf.link(x, y - 4, Math.max(25, pdf.getTextWidth(label)), 6, { url });
  pdf.setTextColor(42, 47, 44);
}

export async function buildCatalogPDF(
  snapshot: CatalogSnapshot,
  variant: CatalogVariant,
  onProgress?: (percent: number) => void,
  sharedImageCache: ImageCache = new Map(),
): Promise<Blob> {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const categoryPages = new Map<string, number>();
  let colorsPage = 0;
  let finishesPage = 0;
  const totalItems = snapshot.products.length + snapshot.colors.length + snapshot.finishes.length;
  let completed = 0;
  const advance = () => {
    completed += 1;
    onProgress?.(Math.round((completed / Math.max(1, totalItems)) * 100));
  };

  // Page one is reserved for the cover and clickable index.
  for (const category of snapshot.categories) {
    categoryPages.set(category, pdf.getNumberOfPages() + 1);
    pdf.addPage();
    const products = snapshot.products.filter((product) => product.category === category);
    const categoryImage = products.find((product) => product.images?.[0])?.images?.[0];
    await addCategoryCover(pdf, category, categoryImage, sharedImageCache);
    addBackToIndex(pdf);
    pdf.addPage();
    addBackToIndex(pdf);
    let currentY = 15;

    for (const product of products) {
      const sizes = product.product_sizes ?? [];
      const rowLineHeight = 7;
      const tableHeight = 12 + rowLineHeight * Math.max(1, sizes.length);
      const rowHeight = Math.max(78, 32 + tableHeight);
      if (currentY + rowHeight > pageHeight - 16) {
        pdf.addPage();
        addBackToIndex(pdf);
        currentY = 15;
      }
      pdf.setDrawColor(205, 211, 206);
      pdf.setLineWidth(0.35);
      pdf.rect(margin, currentY, contentWidth, rowHeight, "S");
      const imageWidth = 70;
      const imageX = pageWidth - margin - imageWidth;
      const imageUrl = product.images?.[0];
      if (imageUrl) {
        const added = await addImageContained(
          pdf,
          imageUrl,
          imageX,
          currentY,
          imageWidth,
          rowHeight,
          sharedImageCache,
        );
        if (!added) addImagePlaceholder(pdf, imageX, currentY, imageWidth, rowHeight);
      } else {
        addImagePlaceholder(pdf, imageX, currentY, imageWidth, rowHeight);
      }
      const textX = margin + 7;
      const textWidth = contentWidth - imageWidth - 14;
      pdf.setTextColor(42, 47, 44);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.text(pdf.splitTextToSize(product.name, textWidth).slice(0, 2), textX, currentY + 9);
      const applicableFinishes = (product.product_finishes ?? [])
        .map((relation) => snapshot.finishes.find((finish) => finish.name === relation.name))
        .filter((finish): finish is AttributeTerm => Boolean(finish));
      const priceFinishes = applicableFinishes.length
        ? applicableFinishes
        : [{ name: "Padrão", extra_price: 0 } as AttributeTerm];
      const tableX = textX;
      const tableY = currentY + 20;
      const tableWidth = textWidth;
      const sizeColumnWidth = Math.min(24, tableWidth * 0.25);
      const finishColumnWidth = (tableWidth - sizeColumnWidth) / priceFinishes.length;
      const headerHeight = 12;

      pdf.setFillColor(246, 248, 245);
      pdf.rect(tableX, tableY, tableWidth, headerHeight, "F");
      pdf.setDrawColor(218, 222, 218);
      pdf.setLineWidth(0.25);
      pdf.rect(
        tableX,
        tableY,
        tableWidth,
        headerHeight + rowLineHeight * Math.max(1, sizes.length),
        "S",
      );
      pdf.line(
        tableX + sizeColumnWidth,
        tableY,
        tableX + sizeColumnWidth,
        tableY + headerHeight + rowLineHeight * Math.max(1, sizes.length),
      );
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6.5);
      pdf.setTextColor(65, 72, 67);
      pdf.text("Altura × Largura × Comprimento (cm)", tableX + 2, tableY + 7);
      priceFinishes.forEach((finish, finishIndex) => {
        const columnX = tableX + sizeColumnWidth + finishColumnWidth * finishIndex;
        if (finishIndex > 0) {
          pdf.line(
            columnX,
            tableY,
            columnX,
            tableY + headerHeight + rowLineHeight * Math.max(1, sizes.length),
          );
        }
        const labelLines = pdf
          .splitTextToSize(finish.name, Math.max(8, finishColumnWidth - 2))
          .slice(0, 2);
        pdf.text(labelLines, columnX + finishColumnWidth / 2, tableY + 5, { align: "center" });
      });

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);
      sizes.forEach((size, sizeIndex) => {
        const rowY = tableY + headerHeight + rowLineHeight * sizeIndex;
        pdf.line(tableX, rowY, tableX + tableWidth, rowY);
        const rawSize = size.size || size.name || "Único";
        const dimensions = parseDims(rawSize);
        const sizeLabel = dimensions
          ? `${dimensions.altura} × ${dimensions.largura} × ${dimensions.comprimento}`
          : rawSize;
        pdf.text(
          pdf.splitTextToSize(sizeLabel, sizeColumnWidth - 3).slice(0, 1),
          tableX + 2,
          rowY + rowLineHeight * 0.68,
        );
        const basePrice = size.sale_price ?? size.base_price;
        priceFinishes.forEach((finish, finishIndex) => {
          const fullPrice = basePrice + (Number(finish.extra_price) || 0);
          const finalPrice =
            variant === "reseller" ? fullPrice * (1 - RESELLER_DISCOUNT) : fullPrice;
          const priceX =
            tableX + sizeColumnWidth + finishColumnWidth * finishIndex + finishColumnWidth / 2;
          pdf.text(
            `R$ ${finalPrice.toFixed(2).replace(".", ",")}`,
            priceX,
            rowY + rowLineHeight * 0.68,
            { align: "center" },
          );
        });
      });
      const buttonWidth = 64;
      const buttonHeight = 8;
      const buttonX = imageX + (imageWidth - buttonWidth) / 2;
      const buttonY = currentY + rowHeight - 13;
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 4, 4, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(42, 47, 44);
      pdf.setFontSize(6.5);
      pdf.text(
        "Clique aqui para ver detalhes do produto",
        buttonX + buttonWidth / 2,
        buttonY + 5.2,
        { align: "center" },
      );
      pdf.link(buttonX, buttonY, buttonWidth, buttonHeight, {
        url: absoluteUrl(`/produto/${product.slug}`),
      });
      pdf.setDrawColor(205, 211, 206);
      pdf.setLineWidth(0.35);
      pdf.line(imageX, currentY, imageX, currentY + rowHeight);
      pdf.rect(margin, currentY, contentWidth, rowHeight, "S");
      currentY += rowHeight + 5;
      advance();
    }
  }

  async function addAttributeSection(title: string, items: AttributeTerm[]) {
    const firstPage = pdf.getNumberOfPages() + 1;
    if (items.length === 0) {
      pdf.addPage();
      addPageTitle(pdf, title);
      addBackToIndex(pdf);
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
        addBackToIndex(pdf);
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
    return firstPage;
  }

  colorsPage = await addAttributeSection("Cores disponíveis", snapshot.colors);
  finishesPage = await addAttributeSection("Acabamentos disponíveis", snapshot.finishes);

  pdf.setPage(1);
  pdf.setFillColor(250, 250, 247);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");
  if (snapshot.coverImage) {
    await addImageContained(pdf, snapshot.coverImage, 0, 0, pageWidth, 105, sharedImageCache);
  }
  pdf.setFillColor(42, 47, 44);
  pdf.rect(0, 70, pageWidth, 35, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(27);
  pdf.text("Catálogo Arteno", pageWidth / 2, 86, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(
    variant === "reseller"
      ? "Tabela para revendedores — 30% de desconto"
      : "Tabela de preços padrão",
    pageWidth / 2,
    95,
    { align: "center" },
  );
  pdf.setTextColor(105, 112, 107);
  pdf.setFontSize(9);
  pdf.text(`Atualizado em ${snapshot.generatedAt.toLocaleString("pt-BR")}`, margin, 116);
  pdf.setTextColor(42, 47, 44);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text("Índice", margin, 130);
  let indexY = 141;
  pdf.setFontSize(11);
  for (const category of snapshot.categories) {
    const page = categoryPages.get(category)!;
    pdf.setFont("helvetica", "normal");
    pdf.text(category, margin, indexY);
    pdf.text(String(page), pageWidth - margin, indexY, { align: "right" });
    pdf.link(margin, indexY - 5, contentWidth, 7, { pageNumber: page });
    indexY += 8;
  }
  indexY += 4;
  for (const entry of [
    { label: "Cores disponíveis", page: colorsPage },
    { label: "Acabamentos disponíveis", page: finishesPage },
  ]) {
    pdf.setFont("helvetica", "bold");
    pdf.text(entry.label, margin, indexY);
    pdf.text(String(entry.page), pageWidth - margin, indexY, { align: "right" });
    pdf.link(margin, indexY - 5, contentWidth, 7, { pageNumber: entry.page });
    indexY += 9;
  }

  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(125, 130, 126);
    pdf.text(`Página ${page} de ${totalPages}`, pageWidth / 2, pageHeight - 7, { align: "center" });
  }
  onProgress?.(100);
  return pdf.output("blob");
}
