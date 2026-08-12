import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const mode = process.argv[2] ?? "--dry-run";
const rollbackFile = process.argv[3];
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const uploadRoot = process.env.UPLOAD_DIR;
const uploadBase = (process.env.UPLOAD_BASE_URL ?? "/uploads").replace(/\/$/, "");
const manifestRoot =
  process.env.MEDIA_MIGRATION_DIR ?? join(dirname(uploadRoot ?? "."), "migrations");

if (!supabaseUrl || !serviceKey || !uploadRoot) {
  throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e UPLOAD_DIR são obrigatórios.");
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function readTable(table, columns) {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

async function readState() {
  const [products, categories, finishes, colors] = await Promise.all([
    readTable("products", "id,slug,images"),
    readTable("categories", "id,slug,cover_image"),
    readTable("finish_catalog", "name,image_url,gallery"),
    readTable("color_catalog", "name,image_url,gallery"),
  ]);
  let heroSlides = [];
  const { data, error } = await supabase.storage
    .from("catalog-media")
    .download("home/hero-slides.json");
  if (!error && data) {
    const parsed = JSON.parse(await data.text());
    if (Array.isArray(parsed)) heroSlides = parsed;
  }
  return { products, categories, finishes, colors, heroSlides };
}

function isPending(url) {
  if (typeof url !== "string" || !url.trim() || url.startsWith("/uploads/")) return false;
  try {
    return new URL(url).host === new URL(supabaseUrl).host;
  } catch {
    return false;
  }
}

function collect(state) {
  const entries = [];
  const add = (folder, value) => {
    if (isPending(value)) entries.push({ folder, oldUrl: value.trim() });
  };
  for (const row of state.products) for (const url of row.images ?? []) add("products", url);
  for (const row of state.categories) add("categories", row.cover_image);
  for (const row of state.finishes) {
    add("finishes", row.image_url);
    for (const url of row.gallery ?? [])
      if (!String(url).startsWith("__video__:")) add("finishes", url);
  }
  for (const row of state.colors) {
    add("colors", row.image_url);
    for (const url of row.gallery ?? [])
      if (!String(url).startsWith("__video__:")) add("colors", url);
  }
  for (const row of state.heroSlides) add("banners", row.image);
  return [...new Map(entries.map((entry) => [entry.oldUrl, entry])).values()];
}

async function saveHero(slides) {
  if (!slides.length) return;
  const body = new Blob([JSON.stringify(slides, null, 2)], { type: "application/json" });
  const { error } = await supabase.storage
    .from("catalog-media")
    .upload("home/hero-slides.json", body, { upsert: true, contentType: "application/json" });
  if (error) throw new Error(`hero-slides: ${error.message}`);
}

async function writeState(state, map = (value) => value) {
  for (const row of state.products) {
    const { error } = await supabase
      .from("products")
      .update({ images: (row.images ?? []).map(map) })
      .eq("id", row.id);
    if (error) throw new Error(`products/${row.slug}: ${error.message}`);
  }
  for (const row of state.categories) {
    const { error } = await supabase
      .from("categories")
      .update({ cover_image: map(row.cover_image) })
      .eq("id", row.id);
    if (error) throw new Error(`categories/${row.slug}: ${error.message}`);
  }
  for (const row of state.finishes) {
    const { error } = await supabase
      .from("finish_catalog")
      .update({
        image_url: map(row.image_url),
        gallery: (row.gallery ?? []).map(map),
      })
      .eq("name", row.name);
    if (error) throw new Error(`finish_catalog/${row.name}: ${error.message}`);
  }
  for (const row of state.colors) {
    const { error } = await supabase
      .from("color_catalog")
      .update({
        image_url: map(row.image_url),
        gallery: (row.gallery ?? []).map(map),
      })
      .eq("name", row.name);
    if (error) throw new Error(`color_catalog/${row.name}: ${error.message}`);
  }
  await saveHero(state.heroSlides.map((slide) => ({ ...slide, image: map(slide.image) })));
}

async function downloadAndOptimize(entry) {
  const hash = createHash("sha256").update(entry.oldUrl).digest("hex").slice(0, 24);
  const filename = `${hash}.webp`;
  const directory = join(uploadRoot, entry.folder);
  const destination = join(directory, filename);
  const temporary = `${destination}.tmp-${process.pid}`;
  await mkdir(directory, { recursive: true });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(entry.oldUrl, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const source = Buffer.from(await response.arrayBuffer());
    if (source.length === 0 || source.length > 30 * 1024 * 1024)
      throw new Error("tamanho inválido");
    const info = await sharp(source, { limitInputPixels: 64_000_000 })
      .rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 5, smartSubsample: true })
      .toFile(temporary);
    await rename(temporary, destination);
    return {
      ...entry,
      newUrl: `${uploadBase}/${entry.folder}/${filename}`,
      sourceBytes: source.length,
      outputBytes: info.size,
      width: info.width,
      height: info.height,
    };
  } finally {
    clearTimeout(timeout);
    await unlink(temporary).catch(() => {});
  }
}

async function rollback(path) {
  if (!path) throw new Error("Informe o caminho do manifesto para --rollback.");
  const manifest = JSON.parse(await readFile(path, "utf8"));
  if (!manifest.backup) throw new Error("Manifesto sem backup.");
  await writeState(manifest.backup);
  manifest.status = "rolled-back";
  manifest.rolledBackAt = new Date().toISOString();
  await writeFile(path, JSON.stringify(manifest, null, 2));
  console.log("Rollback concluído. Os WebP foram preservados e as URLs originais restauradas.");
}

if (mode === "--rollback") {
  await rollback(rollbackFile);
  process.exit(0);
}

const state = await readState();
const entries = collect(state);
console.log(`Imagens únicas pendentes: ${entries.length}`);
console.table(
  Object.entries(Object.groupBy(entries, (entry) => entry.folder)).map(([folder, rows]) => ({
    grupo: folder,
    imagens: rows.length,
  })),
);

if (mode !== "--apply") {
  console.log("Simulação concluída. Nenhum arquivo ou registro foi alterado.");
  process.exit(0);
}

await mkdir(manifestRoot, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const manifestPath = join(manifestRoot, `media-${stamp}.json`);
const manifest = {
  version: 1,
  status: "processing",
  createdAt: new Date().toISOString(),
  backup: state,
  files: [],
};
await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`Manifesto: ${manifestPath}`);

const failures = [];
for (const [index, entry] of entries.entries()) {
  try {
    const result = await downloadAndOptimize(entry);
    manifest.files.push(result);
    console.log(`[${index + 1}/${entries.length}] OK ${entry.folder}: ${result.outputBytes} bytes`);
  } catch (error) {
    failures.push({ ...entry, error: error instanceof Error ? error.message : String(error) });
    console.error(
      `[${index + 1}/${entries.length}] ERRO ${entry.folder}: ${failures.at(-1).error}`,
    );
  }
  await writeFile(manifestPath, JSON.stringify({ ...manifest, failures }, null, 2));
}

if (failures.length) {
  manifest.status = "files-failed";
  await writeFile(manifestPath, JSON.stringify({ ...manifest, failures }, null, 2));
  throw new Error(`${failures.length} imagens falharam. O banco não foi alterado.`);
}

const replacements = new Map(manifest.files.map((file) => [file.oldUrl, file.newUrl]));
try {
  await writeState(state, (value) => replacements.get(value) ?? value);
} catch (error) {
  console.error("Falha ao atualizar o banco. Restaurando URLs originais...");
  await writeState(state);
  manifest.status = "update-failed-rolled-back";
  manifest.error = error instanceof Error ? error.message : String(error);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  throw error;
}

manifest.status = "applied";
manifest.appliedAt = new Date().toISOString();
manifest.summary = {
  images: manifest.files.length,
  sourceBytes: manifest.files.reduce((sum, file) => sum + file.sourceBytes, 0),
  outputBytes: manifest.files.reduce((sum, file) => sum + file.outputBytes, 0),
};
await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
console.log("Migração concluída.");
console.log(JSON.stringify(manifest.summary, null, 2));
console.log(
  `Rollback: node --env-file=.env scripts/migrate-media-to-vps.mjs --rollback '${manifestPath}'`,
);
