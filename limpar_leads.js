const fs = require("fs");
const path = require("path");
const { slug, parseCSV, serializeCSV, readLeadsCSVs } = require("./csv");

function nameFromLink(link) {
  const m = String(link || "").match(/\/maps\/place\/([^/]+)\/data=/);
  if (!m) return "";
  try {
    return decodeURIComponent(m[1]).replace(/\+/g, " ");
  } catch (e) {
    return m[1].replace(/\+/g, " ");
  }
}

function isCanonical(row) {
  const linkName = nameFromLink(row.link_maps);
  if (!linkName) return true;
  const a = slug(row.nome);
  const b = slug(linkName);
  if (!a || !b) return true;
  return a.includes(b) || b.includes(a);
}

function score(row) {
  let s = 0;
  if (row.telefone) s += 4;
  if (row.email) s += 3;
  if (row.site) s += 3;
  if (row.avaliacao) s += 1;
  if (parseInt(row.num_avaliacoes, 10) > 0) s += 1;
  if (isCanonical(row)) s += 2;
  return s;
}

function dedupeGroup(group) {
  const canonical = group.filter((r) => isCanonical(r));
  const pool = canonical.length ? canonical : group;
  pool.sort((a, b) => score(b) - score(a));
  return pool[0];
}

function cleanFile({ path: full, rows }) {
  const groups = new Map();
  for (const row of rows) {
    const key = [slug(row.nome), row.telefone, slug(row.cidade), slug(row.bairro || "")].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const cleaned = [];
  for (const group of groups.values()) {
    cleaned.push(dedupeGroup(group));
  }
  return cleaned;
}

function main() {
  const dir = __dirname;
  const all = readLeadsCSVs(dir);
  if (all.length === 0) {
    console.log("Nenhum arquivo leads_*.csv encontrado.");
    return;
  }

  for (const entry of all) {
    const before = entry.rows.length;
    const cleaned = cleanFile(entry);
    const after = cleaned.length;

    if (before === after) {
      console.log(`${entry.file}: ${before} linhas (sem mudanças)`);
      continue;
    }

    const backup = entry.path + ".bak";
    if (!fs.existsSync(backup)) {
      fs.copyFileSync(entry.path, backup);
    }

    const header = Object.keys(cleaned[0] || {});
    fs.writeFileSync(entry.path, serializeCSV(cleaned, header), "utf8");
    console.log(`${entry.file}: ${before} -> ${after} linhas (backup em ${path.basename(backup)})`);
  }
}

main();
