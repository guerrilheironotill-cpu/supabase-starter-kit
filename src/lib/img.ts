// Helpers for /api/img, which serves resized copies of files under /uploads/.
const SITE_ORIGIN = /^https?:\/\/(?:www\.)?arteno\.com\.br/i;
const WIDTHS = [320, 480, 640, 800, 1200, 1600];

function uploadPath(src: string | null | undefined): string | null {
  if (!src) return null;
  const path = src.replace(SITE_ORIGIN, "");
  return path.startsWith("/uploads/") && !path.includes("?") ? path : null;
}

function closestWidth(width: number) {
  return WIDTHS.find((candidate) => candidate >= width) ?? WIDTHS[WIDTHS.length - 1];
}

/** Props for an <img> that should download a size close to what it shows. Other sources pass through. */
export function responsiveImage(
  src: string,
  { width, maxWidth = 1600, sizes }: { width: number; maxWidth?: number; sizes: string },
) {
  const path = uploadPath(src);
  if (!path) return { src };
  const srcSet = WIDTHS.filter((candidate) => candidate <= maxWidth)
    .map((candidate) => `/api/img?src=${encodeURIComponent(path)}&w=${candidate} ${candidate}w`)
    .join(", ");
  return {
    src: `/api/img?src=${encodeURIComponent(path)}&w=${closestWidth(width)}`,
    srcSet,
    sizes,
  };
}
