const http = require("http");
const fs = require("fs");
const path = require("path");
const { slug, readLeadsCSVs, serializeCSV } = require("./csv");

const INITIAL_PORT = parseInt(process.env.PORT, 10) || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const STATUS_FILE = path.join(ROOT, "leads_status.json");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function leadId(row) {
  return [slug(row.nome), row.telefone || "", slug(row.cidade), slug(row.bairro || "")].join("|");
}

function loadStatus() {
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, "utf8"));
  } catch (e) {
    return {};
  }
}

function saveStatus(status) {
  fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), "utf8");
}

function loadLeads() {
  const status = loadStatus();
  const leads = [];
  for (const { file, rows } of readLeadsCSVs(ROOT)) {
    for (const row of rows) {
      const id = leadId(row);
      const st = status[id] || { status: "novo", nota: "", atualizado: "" };
      leads.push({
        id,
        nome: row.nome,
        categoria: row.categoria,
        cidade: row.cidade,
        bairro: row.bairro || "",
        endereco: row.endereco,
        telefone: row.telefone,
        email: row.email || "",
        site: row.site,
        avaliacao: parseFloat(String(row.avaliacao).replace(",", ".")) || 0,
        num_avaliacoes: parseInt(row.num_avaliacoes, 10) || 0,
        link_maps: row.link_maps,
        arquivo: file,
        status: st.status,
        nota: st.nota,
        atualizado: st.atualizado,
      });
    }
  }
  return leads;
}

function sendJson(res, code, data) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 1e6) {
        reject(new Error("Body muito grande"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function serveStatic(req, res, urlPath) {
  let filePath = path.join(PUBLIC, urlPath === "/" ? "index.html" : urlPath);
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 - Não encontrado");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  try {
    if (p === "/api/leads") {
      return sendJson(res, 200, loadLeads());
    }

    if (p === "/api/status" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      if (!body.id) return sendJson(res, 400, { error: "id é obrigatório" });
      const status = loadStatus();
      status[body.id] = {
        status: body.status || "novo",
        nota: body.nota || "",
        atualizado: new Date().toISOString(),
      };
      saveStatus(status);
      return sendJson(res, 200, { ok: true });
    }

    if (p === "/api/export") {
      const leads = loadLeads();
      const filter = JSON.parse(url.searchParams.get("filter") || "{}");
      const filtered = applyFilter(leads, filter);
      const header = ["nome", "categoria", "cidade", "bairro", "endereco", "telefone", "email", "site", "avaliacao", "num_avaliacoes", "link_maps", "status", "nota"];
      const rows = filtered.map((l) => ({
        nome: l.nome, categoria: l.categoria, cidade: l.cidade, bairro: l.bairro,
        endereco: l.endereco, telefone: l.telefone, email: l.email, site: l.site,
        avaliacao: l.avaliacao, num_avaliacoes: l.num_avaliacoes,
        link_maps: l.link_maps, status: l.status, nota: l.nota,
      }));
      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="leads_export.csv"',
      });
      res.end(serializeCSV(rows, header));
      return;
    }

    if (p === "/api/reload") {
      return sendJson(res, 200, { ok: true, total: loadLeads().length });
    }

    return serveStatic(req, res, p);
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
});

function applyFilter(leads, f) {
  return leads.filter((l) => {
    if (f.cidade && l.cidade !== f.cidade) return false;
    if (f.bairro && l.bairro !== f.bairro) return false;
    if (f.categoria && l.categoria !== f.categoria) return false;
    if (f.status && l.status !== f.status) return false;
    if (f.avaliacaoMin && l.avaliacao < parseFloat(f.avaliacaoMin)) return false;
    if (f.comTelefone && !l.telefone) return false;
    if (f.comSite && !l.site) return false;
    if (f.semTelefone && l.telefone) return false;
    if (f.semSite && l.site) return false;
    if (f.comEmail && !l.email) return false;
    if (f.semEmail && l.email) return false;
    if (f.q && !(`${l.nome} ${l.email}`.toLowerCase().includes(f.q.toLowerCase()))) return false;
    return true;
  });
}

let port = INITIAL_PORT;

function listenOnAvailablePort() {
  server.once("error", (error) => {
    if (error.code !== "EADDRINUSE" || port >= 65535) {
      throw error;
    }
    port++;
    console.warn(`Porta ocupada. Tentando a porta ${port}...`);
    listenOnAvailablePort();
  });

  server.listen(port, () => {
    console.log(`Dashboard rodando em http://localhost:${port}`);
    console.log(`Dados: ${loadLeads().length} leads carregados de leads_*.csv`);
  });
}

listenOnAvailablePort();
