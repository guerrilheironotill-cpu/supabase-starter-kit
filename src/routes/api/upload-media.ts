import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

const folders = new Set(["products", "categories", "finishes", "colors", "banners", "pages"]);
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const maxUploadBytes = 15 * 1024 * 1024;

async function directorySize(path: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) total += await directorySize(child);
    else if (entry.isFile()) total += (await stat(child)).size;
  }
  return total;
}

export const Route = createFileRoute("/api/upload-media")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const noStore = { "cache-control": "no-store" };
        const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const publishableKey =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!supabaseUrl || !publishableKey || !token) {
          return Response.json(
            { ok: false, error: "Configuração ou sessão ausente." },
            { status: 401, headers: noStore },
          );
        }

        const client = createClient(supabaseUrl, publishableKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData, error: userError } = await client.auth.getUser(token);
        if (userError || !userData.user) {
          return Response.json(
            { ok: false, error: "Sessão inválida." },
            { status: 401, headers: noStore },
          );
        }
        const { data: isAdmin, error: roleError } = await client.rpc("has_role", {
          _user_id: userData.user.id,
          _role: "admin",
        });
        if (roleError || !isAdmin) {
          return Response.json(
            { ok: false, error: "Acesso restrito." },
            { status: 403, headers: noStore },
          );
        }

        const form = await request.formData();
        const file = form.get("file");
        const folder = String(form.get("folder") ?? "");
        if (!(file instanceof File) || !folders.has(folder)) {
          return Response.json(
            { ok: false, error: "Arquivo ou pasta inválida." },
            { status: 400, headers: noStore },
          );
        }
        if (!allowedTypes.has(file.type) || file.size === 0 || file.size > maxUploadBytes) {
          return Response.json(
            { ok: false, error: "Envie JPG, PNG, WebP ou AVIF com até 15 MB." },
            { status: 400, headers: noStore },
          );
        }

        const uploadRoot = process.env.UPLOAD_DIR;
        if (!uploadRoot) {
          return Response.json(
            { ok: false, error: "UPLOAD_DIR não configurado." },
            { status: 503, headers: noStore },
          );
        }
        try {
          const directory = join(uploadRoot, folder);
          await mkdir(directory, { recursive: true });
          const filename = `${randomUUID()}.webp`;
          const destination = join(directory, filename);
          const source = Buffer.from(await file.arrayBuffer());
          const { data: optimized, info } = await sharp(source, { limitInputPixels: 64_000_000 })
            .rotate()
            .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
            .webp({ quality: 82, effort: 5, smartSubsample: true })
            .toBuffer({ resolveWithObject: true });
          const limitBytes =
            Number(process.env.ARTENO_STORAGE_LIMIT_BYTES) || 5 * 1024 * 1024 * 1024;
          const usedBytes = await directorySize(uploadRoot);
          if (usedBytes + optimized.byteLength > limitBytes) {
            return Response.json(
              { ok: false, error: "O limite de armazenamento da Arteno foi atingido." },
              { status: 507, headers: noStore },
            );
          }
          await writeFile(destination, optimized, { flag: "wx" });
          const base = (process.env.UPLOAD_BASE_URL ?? "/uploads").replace(/\/$/, "");
          return Response.json(
            {
              ok: true,
              url: `${base}/${folder}/${filename}`,
              width: info.width,
              height: info.height,
              bytes: optimized.byteLength,
            },
            { headers: noStore },
          );
        } catch (error) {
          return Response.json(
            {
              ok: false,
              error: error instanceof Error ? error.message : "Falha ao processar imagem.",
            },
            { status: 422, headers: noStore },
          );
        }
      },
    },
  },
});
