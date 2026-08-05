// Sincroniza tamanhos e cores do CSV do WooCommerce para o Supabase.
//
// Uso:
//   node --env-file=.env scripts/sync-wc-attributes.mjs <caminho-do-csv> [--dry-run]
//
// Lógica alinhada com o shortcode [product_variations_table]:
//   - "name" do tamanho = SKU da variação (ex: "P", "M", "G", "GG")
//     (no shortcode isso vem de _variation_description, mas no CSV o SKU
//      da variação é o label de tamanho)
//   - Dimensões: Altura x Largura x Comprimento (sem "cm", igual ao shortcode
//     que faz str_replace('-', ' ', ...))
//   - Preço base = coluna "Preço" (equivale a _regular_price)
//   - Preço promocional = coluna "Preço promocional" (equivale a _sale_price)
//   - Cores: do atributo "Cor" do produto pai
//
// Roda com service role key (bypassa RLS). Idempotente: pode rodar várias vezes.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const csvPath = args.find((a) => !a.startsWith("--"));

if (!csvPath) {
  console.error("Usage: node scripts/sync-wc-attributes.mjs <caminho-do-csv> [--dry-run]");
  process.exit(1);
}

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  console.error("Run with: node --env-file=.env scripts/sync-wc-attributes.mjs <csv> [--dry-run]");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------- helpers ----------

function slugify(s) {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toNumber(v) {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Remove "cm" e espaços extras de um valor de dimensão.
// Ex: "55 cm" → "55", "125 cm" → "125"
function stripDim(v) {
  if (!v) return "";
  return v.replace(/\s*cm\s*/gi, "").trim();
}

// Parser CSV minimalista que respeita aspas e vírgulas dentro de campos.
function parseCSV(text) {
  const rows = [];
  let field = "";
  let row = [];
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ",") { row.push(field); field = ""; i++; continue; }
    if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    if (ch === "\r") { i++; continue; }
    field += ch; i++;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

// Encontra o valor de um atributo pelo nome (Altura, Largura, Comprimento, Cor, etc.)
// Os atributos no CSV estão em pares: "Nome do atributo N" seguido de "Valores do atributo N".
function findAttr(header, row, attrName) {
  for (let i = 0; i < header.length; i++) {
    if (header[i] && header[i].startsWith("Nome do atributo") && row[i] === attrName) {
      return (row[i + 1] || "").trim();
    }
  }
  return "";
}

// ---------- main ----------

async function main() {
  console.log("Lendo CSV:", csvPath);
  const raw = readFileSync(csvPath, "utf8");
  const rows = parseCSV(raw);
  if (rows.length < 2) {
    console.error("CSV vazio ou sem dados.");
    process.exit(1);
  }
  const header = rows[0];
  console.log(`CSV: ${rows.length - 1} linhas de dados.`);

  // Índices das colunas principais
  const idx = {
    id: header.indexOf("ID"),
    tipo: header.indexOf("Tipo"),
    nome: header.indexOf("Nome"),
    sku: header.indexOf("SKU"),
    ascendente: header.indexOf("Ascendente"),
    preco: header.indexOf("Preço"),
    precoPromo: header.indexOf("Preço promocional"),
  };

  // Agrupa variações por ID do pai.
  const variaveis = []; // { id, nome, slug, row }
  const variacoesPorPai = new Map(); // paiId -> [{ row, sort }]
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const tipo = row[idx.tipo];
    const id = row[idx.id];
    const nome = row[idx.nome];
    if (tipo === "variable") {
      variaveis.push({ id, nome, slug: slugify(nome), row });
    } else if (tipo === "variation") {
      const asc = row[idx.ascendente] || "";
      const paiId = asc.replace(/^id:/, "").trim();
      if (!paiId) continue;
      if (!variacoesPorPai.has(paiId)) variacoesPorPai.set(paiId, []);
      const skuNum = Number(row[idx.sku]);
      variacoesPorPai.get(paiId).push({ row, sort: Number.isFinite(skuNum) ? skuNum : 9999 });
    }
  }

  console.log(`Produtos variable: ${variaveis.length}`);
  console.log(`Variações agrupadas em ${variacoesPorPai.size} pais.`);

  // Busca produtos no Supabase por slug.
  const slugs = variaveis.map((v) => v.slug);
  const produtosBySlug = new Map();
  if (!dryRun) {
    const PAGE = 500;
    for (let s = 0; s < slugs.length; s += PAGE) {
      const chunk = slugs.slice(s, s + PAGE);
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name")
        .in("slug", chunk);
      if (error) throw error;
      for (const p of data ?? []) produtosBySlug.set(p.slug, p);
    }
    console.log(`Produtos encontrados no Supabase: ${produtosBySlug.size}`);
  } else {
    console.log("[DRY-RUN] Pulando busca no Supabase.\n");
  }

  let stats = { produtosComTamanho: 0, produtosComCor: 0, tamanhos: 0, cores: 0, semMatch: 0 };

  for (const v of variaveis) {
    const produto = produtosBySlug.get(v.slug);
    if (!produto) {
      if (dryRun) console.log(`[DRY-RUN] Sem match: "${v.nome}" (slug: ${v.slug})`);
      stats.semMatch++;
      continue;
    }

    const variacoes = (variacoesPorPai.get(String(v.id)) || [])
      .slice()
      .sort((a, b) => a.sort - b.sort);

    // ---- Tamanhos (alinhado ao shortcode [product_variations_table]) ----
    // Colunas da tabela: Tam. | Alt. | Larg. | Comp. | Estoque | Preço
    // "Tam." = SKU da variação (ex: "P", "M", "G", "GG", "G40", "M30"...)
    // "Alt." = atributo Altura (sem "cm")
    // "Larg." = atributo Largura (sem "cm")
    // "Comp." = atributo Comprimento (sem "cm")
    const sizes = [];
    const seenSizeKey = new Set();
    for (let i = 0; i < variacoes.length; i++) {
      const row = variacoes[i].row;

      // Nome do tamanho = SKU da variação (equivale a _variation_description no shortcode)
      const skuLabel = (row[idx.sku] || "").trim();
      const altura = stripDim(findAttr(header, row, "Altura"));
      const largura = stripDim(findAttr(header, row, "Largura"));
      const comprimento = stripDim(findAttr(header, row, "Comprimento"));

      // Monta o nome do tamanho: "P - 55x125x125" ou só "P" se não tiver dimensões
      const dims = [altura, largura, comprimento].filter(Boolean);
      const name = skuLabel || `Tam ${i + 1}`;
      const sizeLabel = dims.length ? `${name} - ${dims.join("x")}` : name;

      const key = `${name}|${dims.join("x")}`;
      if (seenSizeKey.has(key)) continue;
      seenSizeKey.add(key);

      const base = toNumber(row[idx.preco]);
      const promo = toNumber(row[idx.precoPromo]);

      sizes.push({
        product_id: produto.id,
        size: sizeLabel,
        base_price: base ?? 0,
        sale_price: promo != null && promo < (base ?? Infinity) ? promo : null,
        sort_order: i,
      });
    }

    if (sizes.length) {
      if (dryRun) {
        console.log(`\n[DRY-RUN] ${v.slug} (${v.nome}): ${sizes.length} tamanhos`);
        for (const s of sizes) {
          console.log(`   ${name.padEnd(6)} | ${s.size.padEnd(30)} | R$ ${s.base_price}${s.sale_price ? ` | promo R$ ${s.sale_price}` : ""}`);
        }
      } else {
        const { error: delErr } = await supabase
          .from("product_sizes")
          .delete()
          .eq("product_id", produto.id);
        if (delErr) throw delErr;
        const { error: insErr } = await supabase.from("product_sizes").insert(sizes);
        if (insErr) throw insErr;
      }
      stats.produtosComTamanho++;
      stats.tamanhos += sizes.length;
    }

    // ---- Cores (do atributo "Cor" do produto PAI) ----
    const corValues = findAttr(header, v.row, "Cor");
    let cores = [];
    if (corValues) {
      const lista = corValues
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      const seen = new Set();
      cores = lista
        .filter((c) => {
          const k = c.toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .map((c, i) => ({
          product_id: produto.id,
          color: c,
          sort_order: i,
        }));
    }
    if (cores.length) {
      if (dryRun) {
        console.log(`    Cores: ${cores.map((c) => c.name).join(", ")}`);
      } else {
        const { error: delErr } = await supabase
          .from("product_colors")
          .delete()
          .eq("product_id", produto.id);
        if (delErr) throw delErr;
        const { error: insErr } = await supabase.from("product_colors").insert(cores);
        if (insErr) throw insErr;
      }
      stats.produtosComCor++;
      stats.cores += cores.length;
    }
  }

  console.log("\n=== Resumo ===");
  console.log(`Produtos com tamanhos: ${stats.produtosComTamanho} (${stats.tamanhos} tamanhos)`);
  console.log(`Produtos com cores:    ${stats.produtosComCor} (${stats.cores} cores)`);
  console.log(`Sem match no Supabase: ${stats.semMatch}`);
  if (dryRun) console.log("\n[DRY-RUN] Nenhum dado foi alterado no banco.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
