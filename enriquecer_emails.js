const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { readLeadsCSVs, serializeCSV } = require("./csv");
const { findEmail } = require("./email");

async function main() {
  const entries = readLeadsCSVs(__dirname);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "pt-BR" });
  let encontrados = 0;

  try {
    for (const entry of entries) {
      const backup = entry.path + ".bak-email";
      if (!fs.existsSync(backup)) fs.copyFileSync(entry.path, backup);
      const rows = [];
      for (const row of entry.rows) {
        if (row.site) {
          process.stdout.write(`Consultando ${row.nome}... `);
          row.email = await findEmail(context, row.site);
          if (row.email) {
            encontrados++;
            console.log(row.email);
          } else {
            console.log("não encontrado");
          }
        } else {
          row.email = row.email || "";
        }
        rows.push(row);
      }
      const header = Object.keys(rows[0] || {}).filter((column) => column !== "email");
      const telefoneIndex = header.indexOf("telefone");
      header.splice(telefoneIndex >= 0 ? telefoneIndex + 1 : header.length, 0, "email");
      fs.writeFileSync(entry.path, serializeCSV(rows, header), "utf8");
    }
  } finally {
    await browser.close();
  }
  console.log(`\nTotal de e-mails encontrados: ${encontrados}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
