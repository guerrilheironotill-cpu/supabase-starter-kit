/**
 * One-off migration: baixa imagens dos produtos do WooCommerce (arteno.com.br)
 * e sobe pro Supabase Storage no bucket `product-images` (público).
 * Faz match com a tabela `products` pelo `slug` e atualiza a coluna `images`.
 *
 * Como rodar (local):
 *   1) Crie um .env.local na raiz com:
 *        SUPABASE_URL=https://<seu-projeto>.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=<service role key do Supabase>
 *   2) bun install
 *   3) bun run scripts/import-product-images.ts
 *
 * Onde pegar a Service Role Key:
 *   Supabase Dashboard → Project Settings → API → service_role (secret)
 *   NUNCA comite nem exponha essa key no front — só uso local.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ---- carrega .env.local ----
try {
  const envFile = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  for (const line of envFile.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* sem .env.local, tenta usar process.env */
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WP_BASE = "https://arteno.com.br/wp-json/wc/store/v1/products";
const BUCKET = "product-images";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Faltando SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ---- garante bucket público ----
async function ensureBucket() {
  const { data: existing } = await supabase.storage.getBucket(BUCKET);
  if (existing) {
    if (!existing.public) {
      await supabase.storage.updateBucket(BUCKET, { public: true });
      console.log(`✔ Bucket ${BUCKET} atualizado pra público`);
    } else {
      console.log(`✔ Bucket ${BUCKET} já existe e é público`);
    }
    return;
  }
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (error) throw error;
  console.log(`✔ Bucket ${BUCKET} criado (público)`);
}

// ---- pagina todos os produtos do WooCommerce ----
type WPImage = { src: string; alt?: string };
type WPProduct = { slug: string; name: string; images: WPImage[] };

async function fetchAllWpProducts(): Promise<WPProduct[]> {
  const all: WPProduct[] = [];
  let page = 1;
  while (true) {
    const r = await fetch(`${WP_BASE}?per_page=100&page=${page}`);
    if (!r.ok) throw new Error(`WP page ${page}: ${r.status}`);
    const rows = (await r.json()) as WPProduct[];
    if (!rows.length) break;
    all.push(...rows);
    console.log(`  · página ${page}: +${rows.length} (total ${all.length})`);
    if (rows.length < 100) break;
    page++;
  }
  return all;
}

// ---- baixa 1 imagem e sobe pro storage ----
function extFromUrl(url: string) {
  const clean = url.split("?")[0].split("#")[0];
  const m = clean.match(/\.([a-zA-Z0-9]{2,5})$/);
  return m ? m[1].toLowerCase() : "jpg";
}

function contentTypeFor(ext: string) {
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    webp: "image/webp", gif: "image/gif", avif: "image/avif",
  };
  return map[ext] ?? "image/jpeg";
}

async function uploadOne(slug: string, idx: number, srcUrl: string): Promise<string | null> {
  try {
    const r = await fetch(srcUrl);
    if (!r.ok) {
      console.warn(`    ⚠ falha download ${srcUrl}: ${r.status}`);
      return null;
    }
    const buf = new Uint8Array(await r.arrayBuffer());
    const ext = extFromUrl(srcUrl);
    const path = `${slug}/${idx}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, buf, {
      contentType: contentTypeFor(ext),
      upsert: true,
    });
    if (error) {
      console.warn(`    ⚠ upload falhou ${path}: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.warn(`    ⚠ erro ${srcUrl}: ${(e as Error).message}`);
    return null;
  }
}

// ---- main ----
async function main() {
  console.log("→ Preparando bucket…");
  await ensureBucket();

  console.log("→ Buscando produtos do Supabase…");
  const { data: dbProducts, error } = await supabase
    .from("products")
    .select("id, slug, images");
  if (error) throw error;
  console.log(`  ${dbProducts?.length ?? 0} produtos no Supabase`);

  const bySlug = new Map(dbProducts?.map((p) => [p.slug, p]) ?? []);

  console.log("→ Buscando produtos do WooCommerce…");
  const wpProducts = await fetchAllWpProducts();
  console.log(`  ${wpProducts.length} produtos no WP`);

  let matched = 0, updated = 0, skipped = 0, missing = 0;

  for (const wp of wpProducts) {
    const db = bySlug.get(wp.slug);
    if (!db) { missing++; continue; }
    matched++;

    if (!wp.images?.length) { skipped++; continue; }

    console.log(`• ${wp.slug} (${wp.images.length} imagens)`);
    const newUrls: string[] = [];
    for (let i = 0; i < wp.images.length; i++) {
      const url = await uploadOne(wp.slug, i, wp.images[i].src);
      if (url) newUrls.push(url);
    }

    if (!newUrls.length) { skipped++; continue; }

    const { error: upErr } = await supabase
      .from("products")
      .update({ images: newUrls })
      .eq("id", db.id);
    if (upErr) {
      console.warn(`  ⚠ update falhou: ${upErr.message}`);
      continue;
    }
    updated++;
    console.log(`  ✔ ${newUrls.length} imagens salvas`);
  }

  console.log("\n=== Resumo ===");
  console.log(`WP produtos:         ${wpProducts.length}`);
  console.log(`Match no Supabase:   ${matched}`);
  console.log(`Sem match:           ${wpProducts.length - matched}`);
  console.log(`Produtos atualizados:${updated}`);
  console.log(`Sem imagens/pulados: ${skipped}`);
  console.log(`No Supabase e não no WP: ${missing < 0 ? 0 : (dbProducts?.length ?? 0) - matched}`);
}

main().catch((e) => {
  console.error("💥", e);
  process.exit(1);
});