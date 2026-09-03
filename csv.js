const fs = require("fs");
const path = require("path");

function normalize(t) {
  return (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function slug(t) {
  return normalize(t).replace(/[^a-z0-9]+/g, "");
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const src = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (ch === "\r") {
      // skip
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj = {};
    header.forEach((h, i) => {
      obj[h] = (r[i] || "").trim();
    });
    return obj;
  });
}

function cleanCsvValue(v) {
  return String(v).replace(/\s*\n+\s*/g, " - ").replace(/"/g, '""').trim();
}

function serializeCSV(rows, header) {
  const cols = header || (rows.length ? Object.keys(rows[0]) : []);
  const lines = [cols.map(cleanCsvValue).join(",")];
  for (const r of rows) {
    lines.push(cols.map((c) => `"${cleanCsvValue(r[c] || "")}"`).join(","));
  }
  return "\uFEFF" + lines.join("\n") + "\n";
}

function readLeadsCSVs(dir) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^leads_.*\.csv$/i.test(f))
    .sort();
  const out = [];
  for (const f of files) {
    const full = path.join(dir, f);
    const text = fs.readFileSync(full, "utf8");
    out.push({ file: f, path: full, rows: parseCSV(text) });
  }
  return out;
}

module.exports = { normalize, slug, parseCSV, serializeCSV, readLeadsCSVs, cleanCsvValue };