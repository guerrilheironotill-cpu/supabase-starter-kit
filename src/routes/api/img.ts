import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, normalize, sep } from "node:path";
import sharp from "sharp";

// Resizes uploaded photos on demand (/api/img?src=/uploads/products/x.webp&w=640) so cards,
// the hero and galleries download roughly the size they show. Results are cached on disk and
// served as immutable, since uploads are never overwritten (UUID file names).
const ALLOWED_WIDTHS = new Set([320, 480, 640, 800, 1200, 1600]);
const CACHE_DIR = join(tmpdir(), "arteno-img-cache");
const IMMUTABLE = "public, max-age=31536000, immutable";

export const Route = createFileRoute("/api/img")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const src = params.get("src") ?? "";
        const width = Number(params.get("w"));
        if (!src.startsWith("/uploads/") || !ALLOWED_WIDTHS.has(width) || src.includes("..")) {
          return new Response("Bad request", { status: 400 });
        }

        const cacheFile = join(
          CACHE_DIR,
          `${createHash("sha1").update(`${src}|${width}`).digest("hex")}.webp`,
        );
        try {
          const cached = await readFile(cacheFile);
          return new Response(new Uint8Array(cached), {
            headers: { "content-type": "image/webp", "cache-control": IMMUTABLE },
          });
        } catch {
          // Not cached yet.
        }

        let original: Buffer;
        try {
          const uploadRoot = process.env.UPLOAD_DIR;
          if (uploadRoot) {
            const relative = normalize(src.slice("/uploads/".length));
            const file = join(uploadRoot, relative);
            if (!file.startsWith(normalize(uploadRoot) + sep)) {
              return new Response("Bad request", { status: 400 });
            }
            original = await readFile(file);
          } else {
            // Local development: uploads live on the production host.
            const response = await fetch(`https://arteno.com.br${src}`);
            if (!response.ok) return new Response("Not found", { status: 404 });
            original = Buffer.from(await response.arrayBuffer());
          }
        } catch {
          return new Response("Not found", { status: 404 });
        }

        try {
          const output = await sharp(original, { limitInputPixels: 64_000_000 })
            .rotate()
            .resize({ width, withoutEnlargement: true })
            .webp({ quality: 76, effort: 4 })
            .toBuffer();
          await mkdir(CACHE_DIR, { recursive: true });
          await writeFile(cacheFile, output).catch(() => undefined);
          return new Response(new Uint8Array(output), {
            headers: { "content-type": "image/webp", "cache-control": IMMUTABLE },
          });
        } catch {
          return new Response("Unprocessable image", { status: 422 });
        }
      },
    },
  },
});
