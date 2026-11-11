/**
 * Product descriptions are authored in a rich-text editor (HTML) but older products hold plain
 * text or WooCommerce HTML. These helpers turn any of them into safe HTML for the public page.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "h2",
  "h3",
  "h4",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "a",
  "blockquote",
  "span",
  "hr",
]);
const VOID_TAGS = new Set(["br", "hr"]);
const DROP_WITH_CONTENT =
  /<(script|style|iframe|object|embed|noscript|template)\b[\s\S]*?<\/\1\s*>/gi;

const COLOR_VALUE = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.\s,%]+\)|[a-z]{3,20})$/i;
const ALIGN_VALUE = /^(left|right|center|justify)$/i;

function escapeAttribute(value: string) {
  return value.replace(/&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)/gi, "&amp;").replace(/"/g, "&quot;");
}

function readAttributes(raw: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([a-z][a-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
  for (const match of raw.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attributes;
}

function safeStyle(style: string | undefined): string {
  if (!style) return "";
  const kept: string[] = [];
  for (const declaration of style.split(";")) {
    const separator = declaration.indexOf(":");
    if (separator < 0) continue;
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration.slice(separator + 1).trim();
    if (property === "color" && COLOR_VALUE.test(value)) kept.push(`color: ${value}`);
    if (property === "text-align" && ALIGN_VALUE.test(value)) kept.push(`text-align: ${value}`);
  }
  return kept.join("; ");
}

function safeHref(href: string | undefined): string | null {
  if (!href) return null;
  const value = href.trim();
  if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(value)) return value;
  return null;
}

/** Rebuilds the HTML keeping only a whitelist of tags and attributes (no scripts, no handlers). */
export function sanitizeDescriptionHtml(html: string): string {
  const source = html.replace(DROP_WITH_CONTENT, "");
  let output = "";
  let lastIndex = 0;
  const tagPattern = /<(\/?)([a-z][a-z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
  const escapeText = (text: string) => text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  for (const match of source.matchAll(tagPattern)) {
    output += escapeText(source.slice(lastIndex, match.index));
    lastIndex = match.index + match[0].length;
    const closing = match[1] === "/";
    const name = match[2].toLowerCase();
    if (!ALLOWED_TAGS.has(name)) continue;
    if (closing) {
      if (!VOID_TAGS.has(name)) output += `</${name}>`;
      continue;
    }
    const attributes = readAttributes(match[3]);
    let rendered = `<${name}`;
    const style = safeStyle(attributes.style);
    if (style && name !== "br" && name !== "hr") rendered += ` style="${escapeAttribute(style)}"`;
    if (name === "a") {
      const href = safeHref(attributes.href);
      if (href) {
        rendered += ` href="${escapeAttribute(href)}"`;
        if (/^https?:\/\//i.test(href)) rendered += ' target="_blank" rel="noopener noreferrer"';
      }
    }
    output += `${rendered}>`;
  }
  output += escapeText(source.slice(lastIndex));
  return output;
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** True when the stored value already is HTML (editor output or imported HTML). */
export function descriptionIsHtml(description: string): boolean {
  return /<\/?[a-z][a-z0-9]*(\s[^>]*)?>/i.test(description);
}

/** Plain-text descriptions become paragraphs (blank line) with line breaks (single newline). */
export function plainDescriptionToHtml(description: string): string {
  return description
    .replace(/\\r\\n|\\n|\\r/g, "\n")
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** HTML to load into the editor (any stored format). */
export function descriptionToEditorHtml(description: string | null | undefined): string {
  if (!description?.trim()) return "";
  return descriptionIsHtml(description) ? description : plainDescriptionToHtml(description);
}

/** Safe HTML to show on the public product page. */
export function descriptionToSafeHtml(description: string | null | undefined): string {
  return sanitizeDescriptionHtml(descriptionToEditorHtml(description));
}
