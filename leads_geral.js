const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { findEmail } = require("./email");

const BASE_URL = "https://www.google.com/maps/search/";

let CITY = "Florianópolis";
let CATEGORIES = [
  "padaria", "restaurante", "pizzaria", "sorveteria", "cafeteria",
  "salão de beleza", "barbearia", "estética", "manicure",
  "mecânica de automóveis", "oficina mecânica", "pet shop",
  "clínica odontológica", "academia", "floricultura", "papelaria",
  "marcenaria", "vidraçaria", "lavanderia", "marmoraria", "serralheria",
  "cabeleireiro", "estúdio de tatuagem", "conserto de eletrodomésticos",
  "auto escola", "escola de idiomas", "lavagem de carros",
  "loja de materiais de construção", "funilaria e pintura", "confeitaria",
];
let MAX_RESULTS = 300;
let START = 0;
let HEADED = false;
let ONLY_PHONE = false;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--cidade") CITY = args[++i];
  if (args[i] === "--categorias") CATEGORIES = args[++i].split(",");
  if (args[i] === "--limite") MAX_RESULTS = parseInt(args[++i], 10);
  if (args[i] === "--iniciar") START = parseInt(args[++i], 10);
  if (args[i] === "--headed") HEADED = true;
  if (args[i] === "--somente-telefone") ONLY_PHONE = true;
}

function expandSearchCategories(categories) {
  return categories.flatMap((category) => {
    const key = normalize(category).trim();
    if (key === "yoga") return [category, "estúdio de yoga", "aulas de yoga", "escola de yoga"];
    if (key === "pilates") return [category, "studio de pilates", "aulas de pilates", "fisioterapia e pilates"];
    return [category];
  });
}

CATEGORIES = expandSearchCategories(CATEGORIES);

const OUTPUT = path.join(__dirname, `leads_${CITY.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}.csv`);

function normalize(t) {
  return (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function slug(t) {
  return normalize(t).replace(/[^a-z0-9]+/g, "");
}

function cleanPhone(raw) {
  let p = (raw || "")
    .replace(/^\+55\s?/, "")
    .replace(/^(reserva|delivery|whatsapp|telefone|contato|pedidos?|sac|central)\s*[:.\-]?\s*/i, "")
    .replace(/[^\d\s()+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return p;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function dismissConsent(page) {
  for (const sel of [
    'button[aria-label*="Aceitar"]',
    'button:has-text("Aceitar tudo")',
    'button[aria-label*="Accept"]',
  ]) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1200 })) {
        await btn.click();
        await sleep(800);
        return;
      }
    } catch (e) {}
  }
}

async function loadFeed(page) {
  const seen = new Map();
  let idleRounds = 0;
  for (let i = 0; i < 120; i++) {
    const links = await page.locator("a.hfpxzc").all();
    let count = 0;
    for (const l of links) {
      const href = await l.getAttribute("href");
      if (href && !/aclk|adurl/.test(href)) {
        if (!seen.has(href)) {
          seen.set(href, (await l.getAttribute("aria-label")) || "");
          count++;
        }
      }
    }
    if (count === 0) idleRounds++;
    else idleRounds = 0;
    if (idleRounds >= 8) break;
    if (seen.size >= MAX_RESULTS) break;
    await page.locator('div[role="feed"]').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    }).catch(() => {});
    await sleep(700 + Math.random() * 300);
  }
  return seen;
}

async function extractPlace(page, link, expectedName) {
  const href = link;
  const prevName = await page.locator("h1.DUwDvf").first().innerText().catch(() => "");

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(href, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    await sleep(600);
    try {
      await page.waitForFunction(
        (prev) => {
          const h = document.querySelector("h1.DUwDvf");
          return h && h.innerText.trim() !== prev;
        },
        prevName,
        { timeout: 7000 }
      );
    } catch (e) {}
    await sleep(350);

    const name = (await page.locator("h1.DUwDvf").first().innerText().catch(() => "")) || "";
    if (expectedName && slug(name) && slug(name) !== slug(expectedName)) {
      continue;
    }
    if (name) {
      const get = async (loc) => {
        try {
          const el = page.locator(loc).first();
          if (await el.isVisible({ timeout: 1500 })) {
            return ((await el.innerText()) || "").replace(/\s*\n+\s*/g, " - ").trim();
          }
        } catch (e) {}
        return "";
      };
      const getHref = async (loc) => {
        try {
          const el = page.locator(loc).first();
          if (await el.isVisible({ timeout: 1500 })) {
            return ((await el.getAttribute("href")) || "").trim();
          }
        } catch (e) {}
        return "";
      };
      const address = await get('button[data-item-id="address"]');
      const phone = await get('button[data-item-id*="phone:"]');
      const website = await getHref('a[data-item-id="authority"]');
      const rating = await get("div.F7nice");
      let reviews = "";
      try {
        const el = page.locator('button[aria-label*="avalia"]').first();
        if (await el.isVisible({ timeout: 1200 })) {
          reviews = (await el.getAttribute("aria-label")) || "";
        }
      } catch (e) {}
      return { name, address, phone, website, rating, reviews, href };
    }
  }
  return null;
}

function cleanCsvValue(v) {
  return String(v).replace(/\s*\n+\s*/g, " - ").replace(/"/g, '""').trim();
}

const header = "nome,categoria,cidade,endereco,telefone,email,site,avaliacao,num_avaliacoes,link_maps\n";
let csvExists = fs.existsSync(OUTPUT);

function appendRow(row) {
  if (!csvExists) {
    fs.appendFileSync(OUTPUT, "\uFEFF" + header, "utf8");
    csvExists = true;
  }
  const line = [row.nome, row.categoria, row.cidade, row.endereco, row.telefone, row.email, row.site, row.avaliacao, row.num_avaliacoes, row.link_maps]
    .map((v) => `"${cleanCsvValue(v)}"`)
    .join(",");
  fs.appendFileSync(OUTPUT, line + "\n", "utf8");
}

async function main() {
  const browser = await chromium.launch({
    headless: !HEADED,
    args: ["--disable-blink-features=AutomationControlled", "--lang=pt-BR"],
  });
  const ctx = await browser.newContext({
    locale: "pt-BR",
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();
  const emailContext = ctx;
  let total = 0;
  const seenGlobal = new Set();

  for (let c = START; c < CATEGORIES.length; c++) {
    const category = CATEGORIES[c];
    console.log(`== ${category} (${CITY}) ==`);
    const url = BASE_URL + encodeURIComponent(`${category} em ${CITY}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    await sleep(3000);
    await dismissConsent(page);
    await page.waitForSelector("a.hfpxzc", { timeout: 25000 }).catch(() => {});

    const seen = await loadFeed(page);
    console.log(`  ${seen.size} resultados carregados`);
    const links = [...seen.entries()];
    let salvos = 0;
    const processed = new Set();

    for (const [href, expectedName] of links) {
      if (processed.size >= MAX_RESULTS) break;
      if (/aclk|adurl/.test(href)) continue;
      if (!seen.has(href)) continue;
      if (processed.has(href)) continue;
      processed.add(href);

      const p = await extractPlace(page, href, expectedName);
      if (!p) continue;
      if (!p.name) continue;
      if (normalize(p.address) && !normalize(p.address).includes(normalize(CITY))) continue;

      const phone = cleanPhone(p.phone);
      if (ONLY_PHONE && !phone) continue;
      const email = p.website ? await findEmail(emailContext, p.website) : "";

      const dedupeKey = `${slug(p.name)}|${phone}`;
      if (seenGlobal.has(dedupeKey)) continue;
      seenGlobal.add(dedupeKey);

      const ratingMatch = p.rating.match(/^\s*([\d.,]+)/);
      const reviewsMatch = p.reviews.match(/([\d.,\s]+)\s*avalia/);
      appendRow({
        nome: p.name,
        categoria: category,
        cidade: CITY,
        endereco: p.address,
        telefone: phone,
        email,
        site: p.website || "",
        avaliacao: ratingMatch ? ratingMatch[1] : "",
        num_avaliacoes: reviewsMatch ? reviewsMatch[1].replace(/\s/g, "") : "",
        link_maps: p.href,
      });
      salvos++;
      await sleep(150 + Math.random() * 300);
    }
    console.log(`  ${salvos} salvos`);
    total += salvos;
    await sleep(1500);
  }

  await browser.close();
  console.log(`\nTotal: ${total} leads salvos em ${OUTPUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
