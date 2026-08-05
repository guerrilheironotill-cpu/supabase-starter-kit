import { readFileSync } from "node:fs";

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

const t = readFileSync(process.argv[2], "utf8");
const rows = parseCSV(t);
const h = rows[0];
console.log("=== Colunas de atributo ===");
h.forEach((c, i) => {
  if (c.toLowerCase().includes("atributo")) console.log(i, JSON.stringify(c));
});
console.log("\n=== Primeiras 5 colunas ===");
h.slice(0, 5).forEach((c, i) => console.log(i, JSON.stringify(c)));
console.log("\n=== Total colunas:", h.length);

// Mostra uma linha variable e uma variation
console.log("\n=== Linha variable (primeira) ===");
const variable = rows.find((r) => r[1] === "variable");
if (variable) {
  h.forEach((c, i) => {
    if (variable[i] && variable[i] !== "") console.log(i, JSON.stringify(c), "=", JSON.stringify(variable[i]));
  });
}
console.log("\n=== Linha variation (primeira) ===");
const variation = rows.find((r) => r[1] === "variation");
if (variation) {
  h.forEach((c, i) => {
    if (variation[i] && variation[i] !== "") console.log(i, JSON.stringify(c), "=", JSON.stringify(variation[i]));
  });
}
